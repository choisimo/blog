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
 * All routes are protected by requireBackendKey (applied in index.js).
 *
 * SSE Event types emitted:
 *   ping            - keep-alive heartbeat (every 25 s)
 *   notification    - generic notification { type, title, message, payload? }
 *   ai_task_complete - AI task finished { taskId, result?, title, message }
 *   agent_complete  - Agent run finished { sessionId, title, message }
 *   error           - Server-side error during processing
 */

import { Router } from 'express';

const router = Router();

// ============================================================================
// In-process subscriber registry
// Each entry: { id: string, res: Response, userId?: string }
// ============================================================================

/** @type {Map<string, { res: import('express').Response, userId?: string }>} */
const subscribers = new Map();

let subscriberSeq = 0;

/**
 * Add a subscriber.
 * @param {import('express').Response} res
 * @param {string | undefined} userId
 * @returns {string} subscriber id
 */
function addSubscriber(res, userId) {
  const id = `sub_${++subscriberSeq}_${Date.now()}`;
  subscribers.set(id, { res, userId });
  return id;
}

/**
 * Remove a subscriber by id.
 * @param {string} id
 */
function removeSubscriber(id) {
  subscribers.delete(id);
}

/**
 * Broadcast a named SSE event to all matching subscribers.
 * @param {string} eventName
 * @param {object} data
 * @param {string | undefined} [targetUserId] - if set, only send to this user
 */
function broadcast(eventName, data, targetUserId) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

  const dead = [];
  for (const [id, sub] of subscribers) {
    if (targetUserId && sub.userId !== targetUserId) continue;
    try {
      sub.res.write(payload);
      // flush if compression middleware is present
      if (typeof sub.res.flush === 'function') sub.res.flush();
    } catch {
      dead.push(id);
    }
  }
  dead.forEach(removeSubscriber);
}

/**
 * Send a ping to all subscribers to keep connections alive.
 */
function pingAll() {
  const payload = `event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`;
  const dead = [];
  for (const [id, sub] of subscribers) {
    try {
      sub.res.write(payload);
      if (typeof sub.res.flush === 'function') sub.res.flush();
    } catch {
      dead.push(id);
    }
  }
  dead.forEach(removeSubscriber);
}

// Ping every 25 s so proxies / load-balancers don't close idle connections
const pingInterval = setInterval(pingAll, 25_000);

// Allow the process to exit even if this interval is still running
pingInterval.unref?.();

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /stream
 * SSE subscription endpoint. Keeps connection open until the client disconnects.
 *
 * Query params:
 *   userId  - optional user identifier for targeted broadcasts
 */
router.get('/stream', (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

  // SSE headers — disable buffering everywhere
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx buffering off
  res.flushHeaders();

  // Send an immediate "connected" event so the client knows the stream is live
  res.write(
    `event: notification\ndata: ${JSON.stringify({
      type: 'system',
      title: '알림 연결됨',
      message: '실시간 알림이 활성화되었습니다.',
    })}\n\n`
  );

  const subId = addSubscriber(res, userId);

  // Client disconnect cleanup
  req.on('close', () => {
    removeSubscriber(subId);
  });
  req.on('error', () => {
    removeSubscriber(subId);
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
router.post('/push', (req, res) => {
  const {
    event = 'notification',
    type = 'info',
    title,
    message,
    payload,
    userId,
    sourceId,
  } = req.body ?? {};

  if (!title || !message) {
    return res.status(400).json({
      ok: false,
      error: 'title and message are required',
    });
  }

  broadcast(
    event,
    { type, title, message, payload: payload ?? null, sourceId: sourceId ?? null },
    userId
  );

  return res.json({
    ok: true,
    data: { delivered: subscribers.size },
  });
});

/**
 * GET /health
 * Returns subscriber count.
 */
router.get('/health', (_req, res) => {
  res.json({ ok: true, subscribers: subscribers.size });
});

// ============================================================================
// Export broadcast helper for use by other route modules
// ============================================================================
export { broadcast as broadcastNotification };

export default router;
