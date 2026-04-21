/**
 * Notifications Routes
 *
 * Real-time SSE notification stream for frontend clients.
 * Clients subscribe to /api/v1/notifications/stream and receive
 * named SSE events as they happen.
 *
 * Endpoints:
 * - GET   /stream            - SSE subscription (long-lived connection)
 * - GET   /unread            - List unread notifications for current user
 * - GET   /history           - List recent notification history for current user
 * - PATCH /:id/read          - Mark a notification as read
 * - POST  /push              - Push a notification to connected clients
 * - POST  /outbox/internal   - Durable internal notification push
 * - GET   /health            - Quick health check for this subsystem
 *
 * Security model:
 * - /stream, /unread, /history, /:id/read: protected by user JWT (requireUserAuth)
 * - /push, /outbox/internal, /health: protected by X-Backend-Key (requireBackendKey)
 *
 * SSE Event types emitted:
 *   ping             - keep-alive heartbeat (every 25 s)
 *   notification     - generic notification { type, title, message, payload? }
 *   ai_task_complete - AI task finished { taskId, result?, title, message }
 *   agent_complete   - Agent run finished { sessionId, title, message }
 *   error            - Server-side error during processing
 */

import express, { Router } from "express";
import { requireBackendKey } from "../middleware/backendAuth.js";
import { requireUserAuth } from "../middleware/userAuth.js";
import { getApplicationContainer } from "../application/bootstrap/container.js";
import { createNotificationsService } from "../services/notifications.service.js";
import { normalizeLimit } from "../repositories/notifications.repository.js";

const router = Router();
const {
  ports: { notificationStream },
} = getApplicationContainer();
const notificationsService = createNotificationsService({ notificationStream });

// Ping every 25 s so proxies / load-balancers don't close idle connections
const pingInterval = setInterval(() => notificationStream.pingAll(), 25_000);

// Allow the process to exit even if this interval is still running
pingInterval.unref?.();

// ============================================================================
// Helpers
// ============================================================================

function getAuthenticatedUserId(req) {
  return typeof req.userId === "string" && req.userId.trim()
    ? req.userId
    : null;
}

function parsePushBody(body) {
  const {
    event = "notification",
    type = "info",
    title,
    message,
    payload,
    userId,
    sourceId,
    dedupeKey,
  } = body ?? {};

  return {
    eventName: event,
    type,
    title,
    message,
    payload: payload ?? null,
    targetUserId: userId ?? null,
    sourceId: sourceId ?? null,
    dedupeKey: dedupeKey ?? null,
  };
}

function validatePushBody(push) {
  return Boolean(push?.title && push?.message);
}

export function buildNotificationStreamReadyFrame() {
  return `event: ping\ndata: ${JSON.stringify({ connected: true, ts: Date.now() })}\n\n`;
}

async function handleDurablePush(req, res, { compatibilityMode = false } = {}) {
  const push = parsePushBody(req.body);

  if (!validatePushBody(push)) {
    return res.status(400).json({
      ok: false,
      error: "title and message are required",
    });
  }

  const result = await notificationsService.deliver(push);
  const storage = await notificationsService.getStorageMode();

  return res.json({
    ok: true,
    data: {
      delivered: result.delivered,
      outboxId: result.outbox?.id ?? null,
      inboxId: result.inbox?.id ?? null,
      targeted: Boolean(push.targetUserId),
      storage,
      deduped: result.deduped === true,
      ...(compatibilityMode ? {} : { durable: true }),
    },
  });
}

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

  // Send an immediate keepalive frame so the client knows the stream is live
  // without creating an ID-less notification payload.
  res.write(buildNotificationStreamReadyFrame());

  const subId = notificationStream.addSubscriber(res, userId);

  // Client disconnect cleanup
  req.on("close", () => {
    notificationStream.removeSubscriber(subId);
  });
  req.on("error", () => {
    notificationStream.removeSubscriber(subId);
  });
});

router.get("/unread", requireUserAuth, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const limit = normalizeLimit(req.query.limit);
    const result = await notificationsService.listUnread(userId, { limit });

    return res.json({
      ok: true,
      data: {
        items: result.items,
        unreadCount: result.total,
        limit: result.limit,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: {
        message: error?.message || "Failed to load unread notifications",
        code: "INTERNAL_ERROR",
      },
    });
  }
});

router.get("/history", requireUserAuth, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const limit = normalizeLimit(req.query.limit);
    const result = await notificationsService.listHistory(userId, { limit });

    return res.json({
      ok: true,
      data: {
        items: result.items,
        total: result.total,
        limit: result.limit,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: {
        message: error?.message || "Failed to load notification history",
        code: "INTERNAL_ERROR",
      },
    });
  }
});

router.patch("/:notificationId/read", requireUserAuth, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const notification = await notificationsService.markRead(
      userId,
      req.params.notificationId,
    );

    if (!notification) {
      return res.status(404).json({
        ok: false,
        error: { message: "Notification not found", code: "NOT_FOUND" },
      });
    }

    return res.json({
      ok: true,
      data: {
        id: notification.id,
        readAt: notification.readAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: {
        message: error?.message || "Failed to mark notification as read",
        code: "INTERNAL_ERROR",
      },
    });
  }
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
 *   dedupeKey?: string,            // optional future idempotency key
 * }
 */
router.post(
  "/push",
  requireBackendKey,
  express.json({ limit: "256kb" }),
  async (req, res) => {
    try {
      return await handleDurablePush(req, res, { compatibilityMode: true });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: {
          message: error?.message || "Failed to push notification",
          code: "INTERNAL_ERROR",
        },
      });
    }
  },
);

router.post(
  "/outbox/internal",
  requireBackendKey,
  express.json({ limit: "256kb" }),
  async (req, res) => {
    try {
      return await handleDurablePush(req, res);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: {
          message: error?.message || "Failed to enqueue notification",
          code: "INTERNAL_ERROR",
        },
      });
    }
  },
);

/**
 * GET /health
 * Returns subscriber count and storage mode.
 */
router.get("/health", requireBackendKey, async (_req, res) => {
  try {
    const storage = await notificationsService.getStorageMode();
    return res.json({
      ok: true,
      subscribers: notificationStream.getSubscriberCount(),
      storage,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: {
        message: error?.message || "Failed to inspect notifications subsystem",
        code: "INTERNAL_ERROR",
      },
    });
  }
});

// ============================================================================
// Export broadcast helper for use by other route modules
// ============================================================================
export function broadcastNotification(eventName, data, targetUserId) {
  notificationsService.broadcastBestEffort({
    eventName,
    type: data?.type,
    title: data?.title,
    message: data?.message,
    payload: data?.payload,
    sourceId: data?.sourceId,
    targetUserId,
  });
}

export default router;
