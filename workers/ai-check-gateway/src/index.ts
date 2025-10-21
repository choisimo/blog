type Env = {
  ALLOWED_ORIGINS?: string;
  REAL_BACKEND_HOST: string;
  SECRET_API_KEY: string;
  SECRET_INTERNAL_KEY: string; // Secret for forwarding to backend
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    status: init?.status || 200,
  });
}

function applyCors(headers: Headers, origin: string) {
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const isAllowed = allowed.includes('*') || (origin && allowed.includes(origin));

    // Preflight
    if (request.method === 'OPTIONS') {
      const res = new Response(null, { status: 204 });
      if (isAllowed) applyCors(res.headers, origin);
      return res;
    }

    // Origin check
    if (!isAllowed) {
      const res = json({ error: 'Forbidden: Invalid origin' }, { status: 403 });
      return res;
    }

    // API key check
    const apiKey = request.headers.get('X-API-KEY');
    if (!apiKey || apiKey !== env.SECRET_API_KEY) {
      const res = json({ error: 'Forbidden: Invalid API Key' }, { status: 403 });
      applyCors(res.headers, origin);
      return res;
    }

    // Ensure internal key is configured
    if (!env.SECRET_INTERNAL_KEY) {
      const res = json({ error: 'Server misconfiguration: missing SECRET_INTERNAL_KEY' }, { status: 500 });
      applyCors(res.headers, origin);
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
    reqHeaders.delete('X-Internal-Gateway-Key');
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
      if (isAllowed) applyCors(backendRes.headers, origin);
      return backendRes;
    } catch (err) {
      const res = json({ error: 'Upstream fetch failed' }, { status: 502 });
      applyCors(res.headers, origin);
      return res;
    }
  },
};
