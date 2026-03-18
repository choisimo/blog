/**
 * Notification SSE Service
 *
 * Persistent Server-Sent Events connection for real-time notifications.
 * Lives OUTSIDE the React tree — survives page navigation.
 *
 * Architecture:
 * - Module-level singleton (not a React hook)
 * - Connects to backend SSE endpoint via fetch + ReadableStream
 * - Pushes notifications into useNotificationStore
 * - Auto-reconnects with exponential backoff
 * - Heartbeat keeps connection alive
 *
 * Usage:
 *   import { initNotificationSSE, disposeNotificationSSE } from '@/services/realtime/notificationSSE';
 *   // In App.tsx useEffect (once, on mount):
 *   initNotificationSSE();
 *   return () => disposeNotificationSSE();
 */

import {
  addNotification,
  type NotificationType,
} from "@/stores/realtime/useNotificationStore";
import { getApiBaseUrl } from "@/utils/network/apiBase";
import { bearerAuth } from "@/lib/auth";
import { useAuthStore } from "@/stores/session/useAuthStore";
import {
  findSSEFrameBoundary,
  parseSSEFrame,
  type SSEFrame,
} from "@/services/core/sse-frame";

// ============================================================================
// Config
// ============================================================================

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_JITTER_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 10;
const SLOW_POLL_INTERVAL_MS = 60000;
const PING_TIMEOUT_MS = 60000; // treat connection as dead if no ping for 60s

// ============================================================================
// State
// ============================================================================

let abortController: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingWatchdog: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let slowPollMode = false;
let disposed = false;
let initialized = false;
let authChangeListenerBound = false;

// ============================================================================
// Helpers
// ============================================================================

function getSSEUrl(): string | null {
  try {
    const base = getApiBaseUrl();
    if (!base) return null;
    return `${base.replace(/\/$/, "")}/api/v1/notifications/stream`;
  } catch {
    return null;
  }
}

function resetPingWatchdog() {
  if (pingWatchdog) clearTimeout(pingWatchdog);
  pingWatchdog = setTimeout(() => {
    console.warn("[NotificationSSE] No ping received, reconnecting...");
    reconnect();
  }, PING_TIMEOUT_MS);
}

function clearPingWatchdog() {
  if (pingWatchdog) {
    clearTimeout(pingWatchdog);
    pingWatchdog = null;
  }
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeConnection() {
  if (abortController) {
    try {
      abortController.abort();
    } catch {
      // ignore
    }
    abortController = null;
  }
}

function onAdminAuthChanged() {
  if (disposed) return;
  reconnectAttempts = 0;
  reconnect();
}

function reconnect() {
  if (disposed) return;
  closeConnection();
  clearPingWatchdog();
  clearReconnectTimer();

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    if (!slowPollMode) {
      console.warn(
        "[NotificationSSE] Max reconnect attempts reached, entering slow-poll mode (every 60s)",
      );
    }
    slowPollMode = true;
    reconnectTimer = setTimeout(() => {
      if (!disposed) connect();
    }, SLOW_POLL_INTERVAL_MS);
    return;
  }

  slowPollMode = false;

  const delay = Math.min(
    RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts) +
      Math.random() * RECONNECT_JITTER_MS,
    RECONNECT_MAX_MS,
  );
  reconnectAttempts++;

  reconnectTimer = setTimeout(() => {
    if (!disposed) connect();
  }, delay);
}

// ============================================================================
// Event Handlers
// ============================================================================

interface SSENotificationPayload {
  type?: string;
  title?: string;
  message?: string;
  notificationType?: NotificationType;
  sourceId?: string;
  payload?: Record<string, unknown>;
}

function handleNotificationEvent(data: SSENotificationPayload) {
  const title = data.title || "알림";
  const message = data.message || "";
  const type: NotificationType =
    (data.notificationType as NotificationType) ||
    (data.type === "error"
      ? "error"
      : data.type === "ai_task_complete"
        ? "ai_task_complete"
        : data.type === "agent_complete"
          ? "agent_complete"
          : "info");

  addNotification({
    type,
    title,
    message,
    sourceId: data.sourceId,
    payload: data.payload,
  });
}

function parseSSEData(raw: string): SSENotificationPayload | null {
  try {
    return JSON.parse(raw) as SSENotificationPayload;
  } catch {
    return null;
  }
}

// ============================================================================
// SSE Stream Parser
// ============================================================================

async function parseSSEStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const boundary = findSSEFrameBoundary(buffer);
        if (!boundary) break;

        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.size);

        const event = parseSSEFrame(frame);
        if (event) {
          processSSEEvent(event);
        }
      }
    }

    if (buffer.trim()) {
      const event = parseSSEFrame(buffer);
      if (event) {
        processSSEEvent(event);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name !== "AbortError") {
      console.error("[NotificationSSE] Stream parsing error:", err);
    }
  }
}

function processSSEEvent(event: SSEFrame) {
  const eventName = event.event || "message";
  const data = event.data.trim();

  // Keepalive frames
  if (eventName === "ping" || data === "ping" || data === "{}") {
    resetPingWatchdog();
    return;
  }

  if (!data) return;

  resetPingWatchdog();

  const parsed = parseSSEData(data);
  if (!parsed) {
    return;
  }

  // Handle named events
  switch (eventName) {
    case "notification":
    case "message":
      handleNotificationEvent(parsed);
      break;

    case "ai_task_complete":
      handleNotificationEvent({
        ...parsed,
        notificationType: "ai_task_complete",
        title: parsed.title || "AI 작업 완료",
        message: parsed.message || "AI 작업이 완료되었습니다.",
      });
      break;

    case "agent_complete":
      handleNotificationEvent({
        ...parsed,
        notificationType: "agent_complete",
        title: parsed.title || "AI 에이전트 완료",
        message: parsed.message || "에이전트 작업이 완료되었습니다.",
      });
      break;

    case "ping":
      // Ping event just for keepalive, already handled above
      break;

    case "error":
      handleNotificationEvent({
        ...parsed,
        notificationType: "error",
        title: parsed.title || "오류 발생",
      });
      break;

    default:
      // Unknown event type, try to handle as notification
      if (parsed) {
        handleNotificationEvent(parsed);
      }
  }
}

// ============================================================================
// Connection
// ============================================================================

async function connect() {
  if (disposed) return;

  const url = getSSEUrl();
  if (!url) {
    // No API base configured (dev/offline) — don't attempt connection
    return;
  }

  try {
    const token = await useAuthStore.getState().getValidAccessToken();
    if (!token) {
      clearReconnectTimer();
      reconnectTimer = setTimeout(() => {
        if (!disposed) connect();
      }, 15_000);
      return;
    }

    const controller = new AbortController();
    abortController = controller;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "text/event-stream",
        ...bearerAuth(token),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[NotificationSSE] HTTP error: ${response.status}`);
      reconnect();
      return;
    }

    if (!response.body) {
      console.error("[NotificationSSE] Response body is null");
      reconnect();
      return;
    }

    // Reset attempts on successful connection
    reconnectAttempts = 0;
    slowPollMode = false;
    resetPingWatchdog();

    // Start parsing the stream
    const reader = response.body.getReader();
    await parseSSEStream(reader);

    // If we reach here, stream ended (likely an error on server side)
    if (!disposed) {
      reconnect();
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      // Normal abort, don't reconnect
      return;
    }
    console.error("[NotificationSSE] Failed to connect:", err);
    reconnect();
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize the notification SSE service.
 * Safe to call multiple times — only connects once.
 */
export function initNotificationSSE(): void {
  if (initialized) return;
  disposed = false;
  initialized = true;
  if (typeof window !== "undefined" && !authChangeListenerBound) {
    window.addEventListener("admin-auth-changed", onAdminAuthChanged);
    authChangeListenerBound = true;
  }
  connect();
}

/**
 * Dispose the SSE service — call on app unmount.
 */
export function disposeNotificationSSE(): void {
  disposed = true;
  initialized = false;
  slowPollMode = false;
  clearReconnectTimer();
  clearPingWatchdog();
  closeConnection();
  if (typeof window !== "undefined" && authChangeListenerBound) {
    window.removeEventListener("admin-auth-changed", onAdminAuthChanged);
    authChangeListenerBound = false;
  }
}

/**
 * Manually trigger a reconnect (e.g., after login).
 */
export function reconnectNotificationSSE(): void {
  reconnectAttempts = 0;
  reconnect();
}

/**
 * Push a local (non-SSE) notification directly.
 * Useful for frontend-generated notifications (e.g., long running tasks).
 */
export function pushLocalNotification(
  notif: Parameters<typeof addNotification>[0],
): string {
  return addNotification(notif);
}

export { type NotificationType };
