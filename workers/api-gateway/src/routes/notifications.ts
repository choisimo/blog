import { Hono, type Context } from 'hono';
import type { HonoEnv, Env } from '../types';
import { getCorsHeadersForRequest } from '../lib/cors';
import { requireAuth } from '../middleware/auth';

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

function buildBackendUrl(request: Request, env: Env, path: string): URL | null {
  const backendOrigin = env.BACKEND_ORIGIN;
  if (!backendOrigin) {
    return null;
  }

  const requestUrl = new URL(request.url);
  const backendUrl = new URL(`/api/v1/notifications${path}`, backendOrigin);
  backendUrl.search = requestUrl.search;
  return backendUrl;
}

function buildProxyHeaders(request: Request, env: Env): Headers {
  const headers = new Headers(request.headers);
  const clientIp = request.headers.get('CF-Connecting-IP') || '';

  headers.delete('Host');
  if (env.BACKEND_KEY) {
    headers.set('X-Backend-Key', env.BACKEND_KEY);
  } else {
    headers.delete('X-Backend-Key');
  }

  if (clientIp) {
    headers.set('X-Forwarded-For', clientIp);
    headers.set('X-Real-IP', clientIp);
  }

  return headers;
}

async function proxyNotificationsRequest(
  c: Context<HonoEnv>,
  path: string,
  method: 'GET' | 'PATCH',
  options: { stream?: boolean } = {}
) {
  const corsHeaders = await getCorsHeadersForRequest(c.req.raw, c.env);
  const backendUrl = buildBackendUrl(c.req.raw, c.env, path);

  if (!backendUrl) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { message: 'BACKEND_ORIGIN not configured', code: 'CONFIG_ERROR' },
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

  const headers = buildProxyHeaders(c.req.raw, c.env);
  if (options.stream && !headers.has('Accept')) {
    headers.set('Accept', 'text/event-stream');
  }

  const requestInit: RequestInit = {
    method,
    headers,
    redirect: 'manual',
    signal: c.req.raw.signal,
  };

  if (method !== 'GET') {
    requestInit.body = await c.req.raw.text();
  }

  try {
    const response = await fetch(backendUrl.toString(), requestInit);
    const responseHeaders = new Headers(response.headers);
    applyCorsHeaders(responseHeaders, corsHeaders);

    if (options.stream) {
      responseHeaders.set('Cache-Control', 'no-cache, no-transform');
      responseHeaders.set('Connection', 'keep-alive');
      responseHeaders.set('X-Accel-Buffering', 'no');
    }

    if (response.status >= 502 && response.status <= 504) {
      console.error('Notifications backend returned error status:', response.status);
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            message: `Notifications backend returned ${response.status}. Retry after 30 seconds.`,
            code: 'BACKEND_UNAVAILABLE',
          },
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
  } catch (error) {
    console.error('Notifications proxy failed:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          message: 'Could not connect to notifications backend',
          code: 'BACKEND_UNAVAILABLE',
        },
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
}

notifications.get('/stream', requireAuth, async (c) => {
  return proxyNotificationsRequest(c, '/stream', 'GET', { stream: true });
});

notifications.get('/unread', requireAuth, async (c) => {
  return proxyNotificationsRequest(c, '/unread', 'GET');
});

notifications.get('/history', requireAuth, async (c) => {
  return proxyNotificationsRequest(c, '/history', 'GET');
});

notifications.patch('/:notificationId/read', requireAuth, async (c) => {
  return proxyNotificationsRequest(
    c,
    `/${encodeURIComponent(c.req.param('notificationId'))}/read`,
    'PATCH'
  );
});

export default notifications;
