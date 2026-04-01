/**
 * Admin Logs SSE Proxy
 *
 * Dedicated proxy for /api/v1/admin/logs/stream that preserves SSE semantics.
 * The generic proxyToBackend() function does not set X-Accel-Buffering: no or
 * Cache-Control: no-cache, which causes Cloudflare to buffer the stream.
 * This route mirrors the pattern in notifications.ts.
 */

import { Hono } from 'hono';
import type { HonoEnv, Env } from '../types';
import { getCorsHeadersForRequest } from '../lib/cors';
import { verifyJwt } from '../lib/jwt';
import { unauthorized, forbidden } from '../lib/response';

const adminLogs = new Hono<HonoEnv>();

function applyCorsHeaders(headers: Headers, corsHeaders: Record<string, string>): void {
  headers.delete('Access-Control-Allow-Origin');
  headers.delete('Access-Control-Allow-Credentials');
  headers.delete('Access-Control-Allow-Methods');
  headers.delete('Access-Control-Allow-Headers');
  headers.delete('Access-Control-Max-Age');

  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
}

function buildBackendStreamUrl(request: Request, env: Env): URL | null {
  const backendOrigin = env.BACKEND_ORIGIN;
  if (!backendOrigin) return null;

  const requestUrl = new URL(request.url);
  const backendUrl = new URL('/api/v1/admin/logs/stream', backendOrigin);
  backendUrl.search = requestUrl.search;
  return backendUrl;
}

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

  const corsHeaders = await getCorsHeadersForRequest(c.req.raw, c.env);
  const backendUrl = buildBackendStreamUrl(c.req.raw, c.env);

  if (!backendUrl) {
    return new Response(
      JSON.stringify({
        error: 'Configuration error',
        message: 'BACKEND_ORIGIN not configured',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const headers = new Headers(c.req.raw.headers);
  const clientIp = c.req.raw.headers.get('CF-Connecting-IP') || '';

  headers.set('Host', 'blog-b.nodove.com');
  if (c.env.BACKEND_KEY) {
    headers.set('X-Backend-Key', c.env.BACKEND_KEY);
  } else {
    headers.delete('X-Backend-Key');
  }
  headers.set('X-Forwarded-For', clientIp);
  headers.set('X-Real-IP', clientIp);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'text/event-stream');
  }

  try {
    const response = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: c.req.raw.signal,
    });

    const responseHeaders = new Headers(response.headers);
    applyCorsHeaders(responseHeaders, corsHeaders);
    responseHeaders.set('Cache-Control', 'no-cache, no-transform');
    responseHeaders.set('Connection', 'keep-alive');
    responseHeaders.set('X-Accel-Buffering', 'no');

    if (response.status >= 502 && response.status <= 504) {
      console.error('Admin logs backend returned error status:', response.status);
      return new Response(
        JSON.stringify({
          error: 'Backend unavailable',
          message: `Admin logs backend returned ${response.status}. Retry after 30 seconds.`,
          status: response.status,
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '30',
            ...corsHeaders,
          },
        }
      );
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('Admin logs SSE proxy failed:', err);
    return new Response(
      JSON.stringify({
        error: 'Backend unavailable',
        message: 'Could not connect to admin logs backend',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '30',
          ...corsHeaders,
        },
      }
    );
  }
});

export default adminLogs;
