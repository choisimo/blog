// workers/ai-call-gateway/src/index.ts
// Cloudflare Worker to proxy requests to auto-chat-proxy backend

type Env = {
  ALLOWED_ORIGINS?: string;
  BACKEND_HOST: string;
  SECRET_API_KEY?: string;
  SECRET_INTERNAL_KEY?: string;
};

const JSON_CONTENT_TYPE = { 'Content-Type': 'application/json' } as const;

type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: { message: string; code?: string };
};

function makeResponse<T>(body: ApiResponse<T>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...JSON_CONTENT_TYPE, ...(init?.headers || {}) },
  });
}

function applyCors(headers: Headers, origin: string, requestHeaders?: string | null) {
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin, Access-Control-Request-Headers, Access-Control-Request-Method');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  const incoming = (requestHeaders || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const base = ['Content-Type', 'Authorization', 'X-API-Key'];
  const merged = Array.from(new Set([...base, ...incoming])).join(', ');
  headers.set('Access-Control-Allow-Headers', merged);
  headers.set('Access-Control-Max-Age', '600');
}

function isAllowedOrigin(origin: string, allowedOrigins: string): boolean {
  const allowed = allowedOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes('*') || allowed.includes(origin);
}

async function proxyToBackend(request: Request, env: Env, path: string) {
  const backendUrl = new URL(path, `https://${env.BACKEND_HOST}`);
  
  // Copy query params from original request
  const originalUrl = new URL(request.url);
  originalUrl.searchParams.forEach((value, key) => {
    backendUrl.searchParams.set(key, value);
  });

  const headers = new Headers(request.headers);
  headers.set('Host', env.BACKEND_HOST);
  
  // Forward internal key if configured
  if (env.SECRET_INTERNAL_KEY) {
    headers.set('X-Internal-Gateway-Key', env.SECRET_INTERNAL_KEY);
  }

  // Remove sensitive headers that shouldn't be forwarded
  headers.delete('X-Gateway-Caller-Key');

  const forwarded = new Request(backendUrl.toString(), {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.blob(),
    redirect: 'manual',
  });

  return fetch(forwarded);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = env.ALLOWED_ORIGINS || '';
    const isBrowserAllowed = !!origin && isAllowedOrigin(origin, allowedOrigins);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      if (!isBrowserAllowed) {
        return makeResponse({ ok: false, error: { message: 'Forbidden: Invalid origin' } }, { status: 403 });
      }
      const res = new Response(null, { status: 204 });
      applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
      return res;
    }

    // Allow requests without origin (server-to-server) or with valid origin
    if (origin && !isBrowserAllowed) {
      return makeResponse({ ok: false, error: { message: 'Forbidden: Invalid origin' } }, { status: 403 });
    }

    // Validate backend configuration
    if (!env.BACKEND_HOST) {
      const res = makeResponse({
        ok: false,
        error: { message: 'Server misconfiguration: missing backend host', code: 'MISCONFIGURED' },
      }, { status: 500 });
      if (isBrowserAllowed && origin) {
        applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
      }
      return res;
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route handling
      // POST /auto-chat - Main AI chat endpoint
      // GET /health - Health check
      // GET /status - Status check
      
      const allowedPaths = ['/auto-chat', '/health', '/status'];
      const isAllowedPath = allowedPaths.some(p => path === p || path.startsWith(p + '/'));

      if (!isAllowedPath) {
        const res = makeResponse(
          { ok: false, error: { message: 'Not Found', code: 'NOT_FOUND' } },
          { status: 404 }
        );
        if (isBrowserAllowed && origin) {
          applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
        }
        return res;
      }

      // Validate method for each endpoint
      if (path === '/auto-chat' && request.method !== 'POST') {
        const res = makeResponse(
          { ok: false, error: { message: 'Method Not Allowed', code: 'METHOD_NOT_ALLOWED' } },
          { status: 405 }
        );
        if (isBrowserAllowed && origin) {
          applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
        }
        return res;
      }

      if ((path === '/health' || path === '/status') && request.method !== 'GET') {
        const res = makeResponse(
          { ok: false, error: { message: 'Method Not Allowed', code: 'METHOD_NOT_ALLOWED' } },
          { status: 405 }
        );
        if (isBrowserAllowed && origin) {
          applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
        }
        return res;
      }

      // Proxy to backend
      const backendRes = await proxyToBackend(request, env, path);
      const headers = new Headers(backendRes.headers);
      
      if (isBrowserAllowed && origin) {
        applyCors(headers, origin);
      }
      
      return new Response(backendRes.body, { status: backendRes.status, headers });
    } catch (err) {
      console.error('Proxy request failed', err);
      const res = makeResponse(
        { ok: false, error: { message: 'Upstream fetch failed', code: 'UPSTREAM_ERROR' } },
        { status: 502 }
      );
      if (isBrowserAllowed && origin) {
        applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
      }
      return res;
    }
  },
};
