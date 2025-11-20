// workers/ai-check-gateway/src/index.ts

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

type Env = {
  ALLOWED_ORIGINS?: string;
  REAL_BACKEND_HOST: string;
  SECRET_INTERNAL_KEY: string;
  SECRET_CALLER_KEY?: string;
  GITHUB_TOKEN?: string;
  R2_GATEWAY: Fetcher;
  AUTH_JWT_SECRET?: string;
  AUTH_JWKS_URL?: string;
  AUTH_AUDIENCE?: string;
  AUTH_ISSUER?: string;
  AUTH_CACHE_TTL_SECONDS?: string;
};

const JSON_CONTENT_TYPE = { 'Content-Type': 'application/json' } as const;
const MAX_PAGE_SIZE = 100;
const DEFAULT_CACHE_TTL_SECONDS = 300;
const INTERNAL_CALLER_HEADER = 'X-Gateway-Caller-Key';
const R2_GATEWAY_BASE_URL = 'https://r2-gateway.internal';

type R2GatewayListResponse = {
  ok: boolean;
  cursor: string | null;
  truncated: boolean;
  objects: Array<{
    key: string;
    size: number;
    httpEtag: string | null;
    uploaded: string | null;
  }>;
  delimitedPrefixes: string[];
};

type GatewayFetchOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  searchParams?: Record<string, string | undefined>;
};

function normalizeEtag(value?: string | null) {
  return value?.replace(/"/g, '') ?? null;
}

function buildGatewayUrl(path: string, searchParams?: Record<string, string | undefined>) {
  const url = new URL(path, R2_GATEWAY_BASE_URL);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url;
}

async function gatewayFetch(env: Env, path: string, options: GatewayFetchOptions = {}) {
  const { method = 'GET', headers: initHeaders, body, searchParams } = options;
  const headers = new Headers(initHeaders);
  if (!env.SECRET_CALLER_KEY) {
    throw new Error('SECRET_CALLER_KEY is required for R2 gateway access');
  }
  headers.set(INTERNAL_CALLER_HEADER, env.SECRET_CALLER_KEY);

  const url = buildGatewayUrl(path, searchParams);
  return env.R2_GATEWAY.fetch(url.toString(), {
    method,
    headers,
    body,
  });
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function gatewayErrorResponse(response: Response, fallbackMessage: string, fallbackCode = 'STORAGE_ERROR') {
  const payload = await parseJsonSafe<{ error?: string; code?: string }>(response);
  const message = payload?.error || fallbackMessage;
  const code = payload?.code || fallbackCode;
  const error = code ? { message, code } : { message };
  return makeResponse({ ok: false, error }, { status: response.status });
}

function internalPath(kind: 'memos' | 'personas', userId: string, id?: string) {
  const segments = ['internal', kind, encodeURIComponent(userId)];
  if (id) segments.push(encodeURIComponent(id));
  return segments.join('/');
}

async function fetchGatewayObject<T = Record<string, unknown>>(
  env: Env,
  kind: 'memos' | 'personas',
  userId: string,
  id: string
): Promise<{ data: T; etag: string | null } | null> {
  const response = await gatewayFetch(env, internalPath(kind, userId, id), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch object: ${response.status}`);
  }
  const data = await parseJsonSafe<T>(response);
  if (!data) {
    throw new Error('Invalid JSON payload from R2 gateway');
  }
  return {
    data,
    etag: normalizeEtag(response.headers.get('ETag')),
  };
}

const memoSchema = z.object({
  id: z.string().optional(),
  userNote: z.string().optional().default(''),
  originalContent: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  source: z
    .object({
      conversationId: z.string().min(1),
      messageId: z.string().min(1),
      conversationTitle: z.string().optional(),
    })
    .optional(),
});

const personaSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  prompt: z.string().min(10).max(4000),
  tags: z.array(z.string()).optional().default([]),
});

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message: string; code?: string };
  cursor?: string | null;
  hasMore?: boolean;
};

function makeResponse<T>(body: ApiEnvelope<T>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...JSON_CONTENT_TYPE, ...(init?.headers || {}) },
  });
}

function applyCors(headers: Headers, origin: string, requestHeaders?: string | null) {
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin, Access-Control-Request-Headers, Access-Control-Request-Method');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  const incoming = (requestHeaders || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const base = ['Content-Type', 'Authorization', 'If-Match'];
  const merged = Array.from(new Set([...base, ...incoming])).join(', ');
  headers.set('Access-Control-Allow-Headers', merged);
  headers.set('Access-Control-Max-Age', '600');
}

async function verifyAuth(request: Request, env: Env): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring('Bearer '.length).trim();
  if (!token) return null;

  const audience = env.AUTH_AUDIENCE?.split(',').map((v) => v.trim()).filter(Boolean);
  const issuer = env.AUTH_ISSUER;

  try {
    if (env.AUTH_JWKS_URL) {
      const cacheTtl = parseInt(env.AUTH_CACHE_TTL_SECONDS || '', 10);
      const ttl = Number.isFinite(cacheTtl) && cacheTtl > 0 ? cacheTtl : DEFAULT_CACHE_TTL_SECONDS;
      const JWKS = createRemoteJWKSet(new URL(env.AUTH_JWKS_URL), {
        cacheMaxAge: ttl * 1000,
      });
      const { payload } = await jwtVerify(token, JWKS, {
        audience,
        issuer,
      });
      const sub = payload.sub;
      if (typeof sub !== 'string' || !sub) return null;
      return { userId: sub };
    }

    if (env.AUTH_JWT_SECRET) {
      const encoder = new TextEncoder();
      const { payload } = await jwtVerify(token, encoder.encode(env.AUTH_JWT_SECRET), {
        audience,
        issuer,
      });
      const sub = payload.sub;
      if (typeof sub !== 'string' || !sub) return null;
      return { userId: sub };
    }
  } catch (err) {
    console.warn('JWT verification failed', err instanceof Error ? err.message : err);
    return null;
  }

  return null;
}

function extractIfMatch(request: Request) {
  const header = request.headers.get('If-Match');
  return header ? header.replace(/^"|"$/g, '') : undefined;
}

async function handleList(env: Env, userId: string, kind: 'memos' | 'personas', cursor?: string | null) {
  const response = await gatewayFetch(env, internalPath(kind, userId), {
    searchParams: {
      cursor: cursor || undefined,
      limit: String(MAX_PAGE_SIZE),
    },
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    return gatewayErrorResponse(response, 'Failed to list objects');
  }

  const payload = await parseJsonSafe<R2GatewayListResponse>(response);
  if (!payload?.ok) {
    return makeResponse({ ok: false, error: { message: 'Invalid gateway response' } }, { status: 502 });
  }

  const items = await Promise.all(
    payload.objects.map(async (obj) => {
      const objectId = obj.key.split('/').pop()?.replace(/\.json$/i, '');
      if (!objectId) return null;
      try {
        const gatewayObject = await fetchGatewayObject<Record<string, unknown>>(env, kind, userId, objectId);
        if (!gatewayObject) return null;
        const data = gatewayObject.data;
        return {
          ...data,
          id: typeof data.id === 'string' ? data.id : objectId,
          etag: gatewayObject.etag,
          createdAt:
            typeof data.createdAt === 'string'
              ? data.createdAt
              : obj.uploaded ?? new Date().toISOString(),
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
        };
      } catch (err) {
        console.error('Failed to fetch object from gateway', err);
        return null;
      }
    })
  );

  return makeResponse({
    ok: true,
    data: items.filter(Boolean),
    cursor: payload.cursor,
    hasMore: !!payload.cursor,
  });
}

async function handleGet(env: Env, userId: string, kind: 'memos' | 'personas', id: string) {
  const gatewayObject = await fetchGatewayObject<Record<string, unknown>>(env, kind, userId, id);
  if (!gatewayObject) {
    return makeResponse({ ok: false, error: { message: 'Not found', code: 'NOT_FOUND' } }, { status: 404 });
  }
  const payload = gatewayObject.data;
  return makeResponse({
    ok: true,
    data: {
      ...payload,
      id,
      etag: gatewayObject.etag,
    },
  });
}

async function handlePut(
  env: Env,
  userId: string,
  kind: 'memos' | 'personas',
  id: string,
  payload: z.infer<typeof memoSchema> | z.infer<typeof personaSchema>,
  ifMatch?: string
) {
  const now = new Date().toISOString();

  let createdAt = now;
  let existingEtag: string | null = null;
  let existingData: Record<string, unknown> | null = null;
  try {
    const existing = await fetchGatewayObject<Record<string, unknown>>(env, kind, userId, id);
    if (existing) {
      existingEtag = existing.etag;
      existingData = existing.data;
      if (typeof existing.data?.createdAt === 'string') {
        createdAt = existing.data.createdAt;
      }
    }
  } catch (err) {
    console.error('Failed to read existing object from gateway', err);
    return makeResponse({ ok: false, error: { message: 'Storage error' } }, { status: 502 });
  }

  if (ifMatch && existingEtag && existingEtag !== ifMatch) {
    return makeResponse(
      { ok: false, error: { message: 'ETag mismatch', code: 'PRECONDITION_FAILED' } },
      { status: 412 }
    );
  }
  if (ifMatch && !existingEtag) {
    return makeResponse(
      { ok: false, error: { message: 'Resource not found for provided ETag', code: 'PRECONDITION_FAILED' } },
      { status: 412 }
    );
  }

  const record: Record<string, unknown> = {
    ...payload,
    id,
    userId,
    createdAt,
    updatedAt: now,
  };

  try {
    const response = await gatewayFetch(env, internalPath(kind, userId, id), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(ifMatch ? { 'If-Match': ifMatch } : {}),
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      return gatewayErrorResponse(response, 'Failed to write object');
    }

    const writeResult = await parseJsonSafe<{ ok?: boolean; etag?: string | null }>(response);
    const etag = normalizeEtag(writeResult?.etag ?? response.headers.get('ETag'));
    return makeResponse(
      {
        ok: true,
        data: {
          ...record,
          etag,
        },
      },
      { status: existingData ? 200 : 201 }
    );
  } catch (err) {
    console.error('R2 put failed', err);
    return makeResponse({ ok: false, error: { message: 'Storage error' } }, { status: 502 });
  }
}

async function handleDelete(env: Env, userId: string, kind: 'memos' | 'personas', id: string, ifMatch?: string) {
  try {
    const response = await gatewayFetch(env, internalPath(kind, userId, id), {
      method: 'DELETE',
      headers: ifMatch ? { 'If-Match': ifMatch } : undefined,
    });

    if (response.status === 204) {
      return new Response(null, { status: 204 });
    }

    if (!response.ok) {
      return gatewayErrorResponse(response, 'Failed to delete object');
    }

    return new Response(await response.text(), { status: response.status, headers: response.headers });
  } catch (err) {
    console.error('R2 delete failed', err);
    return makeResponse({ ok: false, error: { message: 'Storage error' } }, { status: 502 });
  }
}

async function routeApi(request: Request, env: Env, userId: string) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/+/, ''); // remove leading slash
  const [, resource, id] = path.split('/'); // api/<resource>/<id?>
  const cursor = url.searchParams.get('cursor');

  if (resource === 'memos') {
    if (request.method === 'GET' && !id) return handleList(env, userId, 'memos', cursor);
    if (request.method === 'GET' && id) return handleGet(env, userId, 'memos', id);
    if (request.method === 'POST') {
      const parsed = memoSchema.parse(await request.json());
      const memoId = parsed.id || crypto.randomUUID();
      return handlePut(env, userId, 'memos', memoId, parsed);
    }
    if (request.method === 'PUT' && id) {
      const parsed = memoSchema.parse(await request.json());
      return handlePut(env, userId, 'memos', id, parsed, extractIfMatch(request));
    }
    if (request.method === 'DELETE' && id) {
      return handleDelete(env, userId, 'memos', id, extractIfMatch(request));
    }
  }

  if (resource === 'personas') {
    if (request.method === 'GET' && !id) return handleList(env, userId, 'personas', cursor);
    if (request.method === 'GET' && id) return handleGet(env, userId, 'personas', id);
    if (request.method === 'POST') {
      const parsed = personaSchema.parse(await request.json());
      const personaId = parsed.id || crypto.randomUUID();
      return handlePut(env, userId, 'personas', personaId, parsed);
    }
    if (request.method === 'PUT' && id) {
      const parsed = personaSchema.parse(await request.json());
      return handlePut(env, userId, 'personas', id, parsed, extractIfMatch(request));
    }
    if (request.method === 'DELETE' && id) {
      return handleDelete(env, userId, 'personas', id, extractIfMatch(request));
    }
  }

  return makeResponse({ ok: false, error: { message: 'Not Found', code: 'NOT_FOUND' } }, { status: 404 });
}

async function proxyToBackend(request: Request, env: Env) {
  const url = new URL(request.url);
  url.hostname = env.REAL_BACKEND_HOST;
  url.protocol = 'https:';

  const headers = new Headers(request.headers);
  headers.set('Host', env.REAL_BACKEND_HOST);
  headers.delete('X-API-KEY');
  headers.delete('X-Gateway-Caller-Key');
  headers.delete('X-Internal-Gateway-Key');
  headers.delete('Authorization');

  headers.set('X-Internal-Gateway-Key', env.SECRET_INTERNAL_KEY);
  headers.set('Authorization', `Bearer ${env.GITHUB_TOKEN}`);
  headers.set('X-Forwarded-Authorization', `Bearer ${env.GITHUB_TOKEN}`);

  const forwarded = new Request(url.toString(), {
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
    const callerKey = request.headers.get('X-Gateway-Caller-Key') || '';
    const allowed = (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const isBrowserAllowed = !!origin && (allowed.includes('*') || allowed.includes(origin));
    const isWorkerAllowed = !origin && !!env.SECRET_CALLER_KEY && callerKey === env.SECRET_CALLER_KEY;

    if (request.method === 'OPTIONS') {
      if (!isBrowserAllowed) {
        return makeResponse({ ok: false, error: { message: 'Forbidden: Invalid origin' } }, { status: 403 });
      }
      const res = new Response(null, { status: 204 });
      applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
      return res;
    }

    if (!(isBrowserAllowed || isWorkerAllowed)) {
      return makeResponse({ ok: false, error: { message: 'Forbidden: Invalid origin' } }, { status: 403 });
    }

    if (!env.SECRET_INTERNAL_KEY || !env.GITHUB_TOKEN) {
      const res = makeResponse({
        ok: false,
        error: { message: 'Server misconfiguration: missing required secrets', code: 'MISCONFIGURED' },
      }, { status: 500 });
      if (isBrowserAllowed && origin) {
        applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
      }
      return res;
    }

    const isApiRoute = request.url.includes('/api/memos') || request.url.includes('/api/personas');

    if (isApiRoute) {
      const auth = await verifyAuth(request, env);
      if (!auth?.userId) {
        const res = makeResponse({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 });
        if (isBrowserAllowed && origin) {
          applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
        }
        return res;
      }

      try {
        const response = await routeApi(request, env, auth.userId);
        if (isBrowserAllowed && origin) {
          applyCors(response.headers, origin, request.headers.get('Access-Control-Request-Headers'));
        }
        return response;
      } catch (err) {
        console.error('API route error', err);
        const res = makeResponse({ ok: false, error: { message: 'Internal error' } }, { status: 500 });
        if (isBrowserAllowed && origin) {
          applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
        }
        return res;
      }
    }

    try {
      const backendRes = await proxyToBackend(request, env);
      const headers = new Headers(backendRes.headers);
      if (isBrowserAllowed && origin) {
        applyCors(headers, origin);
      }
      return new Response(backendRes.body, { status: backendRes.status, headers });
    } catch (err) {
      console.error('Proxy request failed', err);
      const res = makeResponse({ ok: false, error: { message: 'Upstream fetch failed' } }, { status: 502 });
      if (isBrowserAllowed && origin) {
        applyCors(res.headers, origin, request.headers.get('Access-Control-Request-Headers'));
      }
      return res;
    }
  },
};
