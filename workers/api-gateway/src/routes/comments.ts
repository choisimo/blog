import { Hono, type Context } from 'hono';
import type { HonoEnv, Env } from '../types';
import { getCorsHeadersForRequest } from '../lib/cors';
import { requireAdmin } from '../middleware/auth';

const comments = new Hono<HonoEnv>();

function applyCorsHeaders(
  headers: Headers,
  corsHeaders: Record<string, string>
): void {
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
  if (!env.BACKEND_ORIGIN) {
    return null;
  }

  const requestUrl = new URL(request.url);
  const suffix = requestUrl.pathname.replace(/^\/api\/v1\/comments/, '');
  const backendUrl = new URL(`/api/v1/comments${suffix}`, env.BACKEND_ORIGIN);
  backendUrl.search = requestUrl.search;
  return backendUrl;
}

async function proxyComments(
  c: Context<HonoEnv>,
  options: { sse?: boolean } = {}
): Promise<Response> {
  const corsHeaders = await getCorsHeadersForRequest(c.req.raw, c.env);
  const backendUrl = buildBackendUrl(c.req.raw, c.env);

  if (!backendUrl) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          message: 'BACKEND_ORIGIN not configured',
          code: 'CONFIG_ERROR',
        },
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

  headers.delete('Host');
  headers.set('Host', 'blog-b.nodove.com');
  if (c.env.BACKEND_KEY) {
    headers.set('X-Backend-Key', c.env.BACKEND_KEY);
  } else {
    headers.delete('X-Backend-Key');
  }
  headers.set('X-Forwarded-For', clientIp);
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Real-IP', clientIp);
  headers.set('X-Request-ID', crypto.randomUUID());
  headers.set('CF-IPCountry', c.req.raw.headers.get('CF-IPCountry') || '');

  const init: RequestInit & { duplex?: 'half' } = {
    method: c.req.raw.method,
    headers,
    redirect: 'manual',
    signal: c.req.raw.signal,
  };

  if (c.req.raw.method !== 'GET' && c.req.raw.method !== 'HEAD') {
    init.body = c.req.raw.body;
    init.duplex = 'half';
  }

  try {
    const response = await fetch(backendUrl.toString(), init);
    const responseHeaders = new Headers(response.headers);

    applyCorsHeaders(responseHeaders, corsHeaders);

    if (options.sse) {
      responseHeaders.set('Cache-Control', 'no-cache, no-transform');
      responseHeaders.set('Connection', 'keep-alive');
      responseHeaders.set('X-Accel-Buffering', 'no');
    }

    if (response.status >= 502 && response.status <= 504) {
      responseHeaders.delete('Content-Length');
      responseHeaders.set('Content-Type', 'application/json');
      responseHeaders.set('Retry-After', '30');

      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            message: `Comments backend returned ${response.status}. Retry after 30 seconds.`,
            code: 'BACKEND_UNAVAILABLE',
          },
        }),
        {
          status: 503,
          headers: responseHeaders,
        }
      );
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Comments proxy failed:', error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          message: 'Could not connect to comments backend',
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

comments.get('/', async (c) => proxyComments(c));
comments.post('/', async (c) => proxyComments(c));
comments.get('/stream', async (c) => proxyComments(c, { sse: true }));
comments.get('/reactions/batch', async (c) => proxyComments(c));
comments.get('/:commentId/reactions', async (c) => proxyComments(c));
comments.post('/:commentId/reactions', async (c) => proxyComments(c));
comments.delete('/:commentId/reactions', async (c) => proxyComments(c));
comments.delete('/:id', requireAdmin, async (c) => proxyComments(c));

export default comments;
