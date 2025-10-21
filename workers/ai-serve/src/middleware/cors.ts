export type Env = {
  ALLOWED_ORIGINS?: string;
  DEFAULT_PROVIDER?: string;
  DEFAULT_MODEL?: string;
};

export function withCors(handler: (request: Request, env: Env) => Promise<Response> | Response) {
  return async (request: Request, env: Env): Promise<Response> => {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
    const isAllowed = allowed.includes('*') || allowed.includes(origin);

    if (request.method === 'OPTIONS') {
      const res = new Response(null, { status: 204 });
      if (isAllowed) applyCors(res.headers, origin);
      return res;
    }

    const res = await handler(request, env);
    if (isAllowed) applyCors(res.headers, origin);
    return res;
  };
}

function applyCors(headers: Headers, origin: string) {
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
}
