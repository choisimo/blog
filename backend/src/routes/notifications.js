/**
 * Notifications Routes
 *
 * Real-time SSE notification stream for frontend clients.
 * Clients subscribe to /api/v1/notifications/stream and receive
 * named SSE events as they happen.
 *
 * Endpoints:
 * - GET  /stream          - SSE subscription (long-lived connection)
 * - POST /push            - Push a notification to all connected clients
 * - GET  /health          - Quick health check for this subsystem
 *
 * Security model:
 * - /stream: protected by user JWT (requireUserAuth)
 * - /push, /health: protected by X-Backend-Key (requireBackendKey)
 *
 * SSE Event types emitted:
 *   ping            - keep-alive heartbeat (every 25 s)
 *   notification    - generic notification { type, title, message, payload? }
 *   ai_task_complete - AI task finished { taskId, result?, title, message }
 *   agent_complete  - Agent run finished { sessionId, title, message }
 *   error           - Server-side error during processing
 */

import express, { Router } from "express";
import { requireBackendKey } from "../middleware/backendAuth.js";
import { requireUserAuth } from "../middleware/userAuth.js";
import { getApplicationContainer } from "../application/bootstrap/container.js";

const router = Router();
const {
  ports: { notificationStream },
} = getApplicationContainer();

// Ping every 25 s so proxies / load-balancers don't close idle connections
const pingInterval = setInterval(() => notificationStream.pingAll(), 25_000);

// Allow the process to exit even if this interval is still running
pingInterval.unref?.();

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /stream
 * SSE subscription endpoint. Keeps connection open until the client disconnects.
 *
 * Subscriber identity is derived from JWT claims (req.userId).
 */
router.get("/stream", requireUserAuth, (req, res) => {
  const userId = typeof req.userId === "string" ? req.userId : undefined;

  // SSE headers — disable buffering everywhere
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Nginx buffering off
  res.flushHeaders();

  // Send an immediate "connected" event so the client knows the stream is live
  res.write(
    `event: notification\ndata: ${JSON.stringify({
      type: "system",
      title: "알림 연결됨",
      message: "실시간 알림이 활성화되었습니다.",
    })}\n\n`,
  );

  const subId = notificationStream.addSubscriber(res, userId);

  // Client disconnect cleanup
  req.on("close", () => {
    notificationStream.removeSubscriber(subId);
  });
  req.on("error", () => {
    notificationStream.removeSubscriber(subId);
  });
});

/**
 * POST /push
 * Push a notification to connected clients.
 *
 * Body:
 * {
 *   event?:   string,              // SSE event name (default: "notification")
 *   type?:    string,              // notification type tag
 *   title:    string,
 *   message:  string,
 *   payload?: object,
 *   userId?:  string,              // target specific user; omit for broadcast
 *   sourceId?: string,             // optional task/session id
 * }
 */
router.post(
  "/push",
  requireBackendKey,
  express.json({ limit: "256kb" }),
  (req, res) => {
    const {
      event = "notification",
      type = "info",
      title,
      message,
      payload,
      userId,
      sourceId,
    } = req.body ?? {};

    if (!title || !message) {
      return res.status(400).json({
        ok: false,
        error: "title and message are required",
      });
    }

    notificationStream.broadcast(
      event,
      {
        type,
        title,
        message,
        payload: payload ?? null,
        sourceId: sourceId ?? null,
      },
      userId,
    );

    return res.json({
      ok: true,
      data: { delivered: notificationStream.getSubscriberCount() },
    });
  },
);

/**
 * GET /health
 * Returns subscriber count.
 */
router.get("/health", requireBackendKey, (_req, res) => {
  res.json({ ok: true, subscribers: notificationStream.getSubscriberCount() });
});

// ============================================================================
// Export broadcast helper for use by other route modules
// ============================================================================
export function broadcastNotification(eventName, data, targetUserId) {
  notificationStream.broadcast(eventName, data, targetUserId);
}

export default router;
