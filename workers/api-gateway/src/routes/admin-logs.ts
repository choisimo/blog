/**
 * Admin Logs SSE Proxy
 *
 * Dedicated proxy for /api/v1/admin/logs/stream that preserves SSE semantics.
 * The generic proxyToBackend() function does not set X-Accel-Buffering: no or
 * Cache-Control: no-cache, which causes Cloudflare to buffer the stream.
 * This route mirrors the pattern in notifications.ts.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { verifyJwt } from '../lib/jwt';
import { unauthorized, forbidden } from '../lib/response';
import { proxyToBackendWithPolicy } from '../lib/backend-proxy';

const adminLogs = new Hono<HonoEnv>();

/**
 * GET /api/v1/admin/logs/stream
 * SSE log stream — proxied to backend with proper streaming headers.
 * Auth: requireAdmin (token may be passed as ?token= query param for EventSource compatibility)
 */
adminLogs.get('/stream', async (c) => {
  const authHeader = c.req.header('Authorization');
  const queryToken = c.req.query('token');
  const rawToken = authHeader
    ? authHeader.replace(/^Bearer\s+/i, '').trim()
    : (queryToken ?? '');

  if (!rawToken) {
    return unauthorized(c, 'Missing auth token');
  }

  try {
    const payload = await verifyJwt(rawToken, c.env);
    if (payload.type === 'refresh') {
      return unauthorized(c, 'Invalid token type');
    }
    if (payload.role !== 'admin') {
      return forbidden(c, 'Admin role required');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    return unauthorized(c, message);
  }

  return proxyToBackendWithPolicy(c, {
    upstreamPath: '/api/v1/admin/logs/stream',
    stream: true,
    backendUnavailableMessage: 'Could not connect to admin logs backend',
  });
});

export default adminLogs;
