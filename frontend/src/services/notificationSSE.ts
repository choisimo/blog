/**
 * Notification SSE Service
 *
 * Persistent Server-Sent Events connection for real-time notifications.
 * Lives OUTSIDE the React tree — survives page navigation.
 *
 * Architecture:
 * - Module-level singleton (not a React hook)
 * - Connects to backend SSE endpoint
 * - Pushes notifications into useNotificationStore
 * - Auto-reconnects with exponential backoff
 * - Heartbeat keeps connection alive
 *
 * Usage:
 *   import { initNotificationSSE, disposeNotificationSSE } from '@/services/notificationSSE';
 *   // In App.tsx useEffect (once, on mount):
 *   initNotificationSSE();
 *   return () => disposeNotificationSSE();
 */

import { addNotification, type NotificationType } from '@/stores/useNotificationStore';
import { getApiBaseUrl } from '@/utils/apiBase';

// ============================================================================
// Config
// ============================================================================

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_JITTER_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 10;
const PING_TIMEOUT_MS = 60000; // treat connection as dead if no ping for 60s

// ============================================================================
// State
// ============================================================================

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingWatchdog: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let disposed = false;
let initialized = false;

// ============================================================================
// Helpers
// ============================================================================

function getSSEUrl(): string | null {
  try {
    const base = getApiBaseUrl();
    if (!base) return null;
    return `${base.replace(/\/$/, '')}/api/v1/notifications/stream`;
  } catch {
    return null;
  }
}

function resetPingWatchdog() {
  if (pingWatchdog) clearTimeout(pingWatchdog);
  pingWatchdog = setTimeout(() => {
    console.warn('[NotificationSSE] No ping received, reconnecting...');
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

function closeEventSource() {
  if (eventSource) {
    eventSource.onopen = null;
    eventSource.onerror = null;
    eventSource.onmessage = null;
    try {
      eventSource.close();
    } catch {
      // ignore
    }
    eventSource = null;
  }
}

function reconnect() {
  if (disposed) return;
  closeEventSource();
  clearPingWatchdog();
  clearReconnectTimer();

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn('[NotificationSSE] Max reconnect attempts reached, giving up');
    return;
  }

  const delay = Math.min(
    RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts) + Math.random() * RECONNECT_JITTER_MS,
    RECONNECT_MAX_MS
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
  const title = data.title || '알림';
  const message = data.message || '';
  const type: NotificationType = (data.notificationType as NotificationType) ||
    (data.type === 'error' ? 'error' :
     data.type === 'ai_task_complete' ? 'ai_task_complete' :
     data.type === 'agent_complete' ? 'agent_complete' :
     'info');

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
// Connection
// ============================================================================

function connect() {
  if (disposed) return;

  const url = getSSEUrl();
  if (!url) {
    // No API base configured (dev/offline) — don't attempt connection
    return;
  }

  try {
    const es = new EventSource(url, { withCredentials: false });
    eventSource = es;

    es.onopen = () => {
      reconnectAttempts = 0;
      resetPingWatchdog();
    };

    es.onerror = () => {
      if (disposed) return;
      reconnect();
    };

    // Generic message (type: "message")
    es.onmessage = (event) => {
      resetPingWatchdog();
      if (event.data === 'ping' || event.data === '{}') return;
      const data = parseSSEData(event.data);
      if (data) handleNotificationEvent(data);
    };

    // Named event: notification
    es.addEventListener('notification', (event: MessageEvent) => {
      resetPingWatchdog();
      const data = parseSSEData(event.data);
      if (data) handleNotificationEvent(data);
    });

    // Named event: ai_task_complete
    es.addEventListener('ai_task_complete', (event: MessageEvent) => {
      resetPingWatchdog();
      const data = parseSSEData(event.data);
      if (data) {
        handleNotificationEvent({
          ...data,
          notificationType: 'ai_task_complete',
          title: data.title || 'AI 작업 완료',
          message: data.message || 'AI 작업이 완료되었습니다.',
        });
      }
    });

    // Named event: agent_complete
    es.addEventListener('agent_complete', (event: MessageEvent) => {
      resetPingWatchdog();
      const data = parseSSEData(event.data);
      if (data) {
        handleNotificationEvent({
          ...data,
          notificationType: 'agent_complete',
          title: data.title || 'AI 에이전트 완료',
          message: data.message || '에이전트 작업이 완료되었습니다.',
        });
      }
    });

    // Named event: ping / keepalive
    es.addEventListener('ping', () => {
      resetPingWatchdog();
    });

    // Named event: error
    es.addEventListener('error', (event: MessageEvent) => {
      resetPingWatchdog();
      const data = parseSSEData(event.data);
      if (data) {
        handleNotificationEvent({
          ...data,
          notificationType: 'error',
          title: data.title || '오류 발생',
        });
      }
    });

  } catch (err) {
    console.error('[NotificationSSE] Failed to create EventSource:', err);
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
  if (initialized || disposed) return;
  initialized = true;
  connect();
}

/**
 * Dispose the SSE service — call on app unmount.
 */
export function disposeNotificationSSE(): void {
  disposed = true;
  initialized = false;
  clearReconnectTimer();
  clearPingWatchdog();
  closeEventSource();
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
  notif: Parameters<typeof addNotification>[0]
): string {
  return addNotification(notif);
}

export { type NotificationType };
