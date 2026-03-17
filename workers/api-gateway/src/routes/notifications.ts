import { Hono } from 'hono';
import type { HonoEnv, Env } from '../types';
import { getCorsHeadersForRequest } from '../lib/cors';

const notifications = new Hono<HonoEnv>();

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

function buildBackendUrl(request: Request, env: Env): URL | null {
  const backendOrigin = env.BACKEND_ORIGIN;
  if (!backendOrigin) {
    return null;
  }

  const requestUrl = new URL(request.url);
  const backendUrl = new URL('/api/v1/notifications/stream', backendOrigin);
  backendUrl.search = requestUrl.search;
  return backendUrl;
}

notifications.get('/stream', async (c) => {
  const corsHeaders = await getCorsHeadersForRequest(c.req.raw, c.env);
  const backendUrl = buildBackendUrl(c.req.raw, c.env);

  if (!backendUrl) {
    return new Response(
      JSON.stringify({
        error: 'Configuration error',
        message: 'BACKEND_ORIGIN not configured',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
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

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Notifications SSE proxy failed:', error);
    return new Response(
      JSON.stringify({
        error: 'Backend unavailable',
        message: 'Could not connect to notifications backend',
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

export default notifications;
