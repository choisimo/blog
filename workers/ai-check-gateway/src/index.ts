type Env = {
  ALLOWED_ORIGINS?: string;
  REAL_BACKEND_HOST: string;
  SECRET_INTERNAL_KEY: string; // Secret for forwarding to backend
  SECRET_CALLER_KEY?: string;   // Secret for worker-to-gateway calls
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    status: init?.status || 200,
  });
}

function applyCors(headers: Headers, origin: string, requestHeaders?: string | null) {
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin, Access-Control-Request-Headers, Access-Control-Request-Method');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  const incoming = (requestHeaders || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const base = ['Content-Type', 'X-API-KEY'];
  const merged = Array.from(new Set([...base, ...incoming])).join(', ');
  headers.set('Access-Control-Allow-Headers', merged);
  headers.set('Access-Control-Max-Age', '600');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const callerKey = request.headers.get('X-Gateway-Caller-Key') || '';
    const allowed = (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const isBrowserAllowed = !!origin && (allowed.includes('*') || allowed.includes(origin));
    const isWorkerAllowed = !origin && !!env.SECRET_CALLER_KEY && callerKey === env.SECRET_CALLER_KEY;

    // Preflight
    if (request.method === 'OPTIONS') {
      // Preflight is only meaningful for browser requests with Origin
      if (!isBrowserAllowed) {
        const res = json({ error: 'Forbidden: Invalid origin' }, { status: 403 });
        return res;
      }
      const res = new Response(null, { status: 204 });
      applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
      return res;
    }

    // Origin check
    if (!(isBrowserAllowed || isWorkerAllowed)) {
      const res = json({ error: 'Forbidden: Invalid origin' }, { status: 403 });
      return res;
    }

    // Ensure internal key is configured
    if (!env.SECRET_INTERNAL_KEY) {
      const res = json({ error: 'Server misconfiguration: missing SECRET_INTERNAL_KEY' }, { status: 500 });
      if (isBrowserAllowed && origin) applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
      return res;
    }

    // Rewrite URL to real backend host
    const url = new URL(request.url);
    url.hostname = env.REAL_BACKEND_HOST;
    // Keep protocol https to reach origin behind Cloudflare
    url.protocol = 'https:';

    // Forward the request preserving method and body; copy headers except host
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set('Host', env.REAL_BACKEND_HOST);
    // Drop any client-provided sensitive headers and inject our internal key
    reqHeaders.delete('X-API-KEY');
    reqHeaders.delete('X-Gateway-Caller-Key');
// 클라이언트가 보낸 관련 헤더는 삭제하고,
reqHeaders.delete('X-Internal-Gateway-Key');
// 워커가 직접 내부 인증용 비밀 키를 헤더에 설정합니다.
reqHeaders.set('X-Internal-Gateway-Key', env.SECRET_INTERNAL_KEY); 

    const forwarded = new Request(url.toString(), {
      method: request.method,
      headers: reqHeaders,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.blob(),
      redirect: 'manual',
    });

    try {
      const backendRes = await fetch(forwarded);

      // Reflect CORS for response
      const headers = new Headers(backendRes.headers);
      if (isBrowserAllowed && origin) applyCors(headers, origin);
      return new Response(backendRes.body, { status: backendRes.status, headers });
    } catch (err) {
      const res = json({ error: 'Upstream fetch failed' }, { status: 502 });
      if (isBrowserAllowed && origin) applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
      return res;
    }
  },
};
