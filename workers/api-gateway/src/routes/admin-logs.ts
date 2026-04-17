/**
 * Admin Logs Proxy
 *
 * Dedicated proxy for /api/v1/admin/logs and /api/v1/admin/logs/stream.
 * The stream route preserves SSE semantics and the list route exposes the
 * backend log history endpoint without requiring callers to bypass the worker.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { HonoEnv } from '../types';
import { verifyJwt } from '../lib/jwt';
import { unauthorized, forbidden } from '../lib/response';
import { proxyToBackendWithPolicy } from '../lib/backend-proxy';

const adminLogs = new Hono<HonoEnv>();

type AdminAuthOptions = {
  allowQueryToken?: boolean;
};

function extractBearerToken(c: Context<HonoEnv>, options: AdminAuthOptions = {}): string {
  const authHeader = c.req.header('Authorization');
  if (authHeader) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }

  if (!options.allowQueryToken) {
    return '';
  }

  return (c.req.query('token') ?? '').trim();
}

async function authorizeAdminRequest(
  c: Context<HonoEnv>,
  options: AdminAuthOptions = {}
): Promise<Response | null> {
  const rawToken = extractBearerToken(c, options);

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
    if (!payload.emailVerified) {
      return forbidden(c, 'Email verification required');
    }
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    return unauthorized(c, message);
  }
}

/**
 * GET /api/v1/admin/logs
 * Historical log list — proxied to backend.
 * Auth: requireAdmin via Authorization header.
 */
adminLogs.get('/', async (c) => {
  const authError = await authorizeAdminRequest(c);
  if (authError) {
    return authError;
  }

  return proxyToBackendWithPolicy(c, {
    upstreamPath: '/api/v1/admin/logs',
    backendUnavailableMessage: 'Could not connect to admin logs backend',
  });
});

/**
 * GET /api/v1/admin/logs/stream
 * SSE log stream — proxied to backend with proper streaming headers.
 * Auth: requireAdmin (token may be passed as ?token= query param for EventSource compatibility)
 */
adminLogs.get('/stream', async (c) => {
  const authError = await authorizeAdminRequest(c, { allowQueryToken: true });
  if (authError) {
    return authError;
  }

  return proxyToBackendWithPolicy(c, {
    upstreamPath: '/api/v1/admin/logs/stream',
    stream: true,
    injectFallbackAuthorization: false,
    backendUnavailableMessage: 'Could not connect to admin logs backend',
  });
});

export default adminLogs;
