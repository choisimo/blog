import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import rag from '../src/routes/rag';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'JWT_SECRET' | 'BACKEND_ORIGIN' | 'BACKEND_KEY'> {}
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/rag', rag);
  return app;
}

async function createAdminToken(): Promise<string> {
  return signJwt(
    {
      sub: 'admin-1',
      role: 'admin',
      username: 'admin',
      emailVerified: true,
      type: 'access',
    },
    env
  );
}

async function createUserToken(): Promise<string> {
  return signJwt(
    {
      sub: 'user-1',
      role: 'user',
      username: 'user',
      type: 'access',
    },
    env
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  env.BACKEND_ORIGIN = 'https://backend.example';
  env.BACKEND_KEY = 'rag-backend-key';
});

describe('rag admin index routes', () => {
  it('proxies document indexing for admin callers', async () => {
    const token = await createAdminToken();
    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { indexed: 1, collection: 'posts' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const app = createApp();
    const response = await app.request(
      'https://example.com/api/v1/rag/index',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Host: 'attacker.example',
        },
        body: JSON.stringify({
          documents: [{ id: 'doc-1', content: 'hello world' }],
          collection: 'posts',
        }),
      },
      env
    );

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);

    const [upstreamUrl, requestInit] = upstreamFetch.mock.calls[0] ?? [];
    const forwardedHeaders = new Headers(requestInit?.headers);

    expect(upstreamUrl).toBe('https://backend.example/api/v1/rag/index');
    expect(requestInit?.method).toBe('POST');
    expect(forwardedHeaders.get('Host')).toBeNull();
    expect(forwardedHeaders.get('X-Backend-Key')).toBe('rag-backend-key');
  });

  it('rejects non-admin callers before the backend proxy', async () => {
    const token = await createUserToken();
    const upstreamFetch = vi.spyOn(globalThis, 'fetch');

    const app = createApp();
    const response = await app.request(
      'https://example.com/api/v1/rag/index',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documents: [{ id: 'doc-1', content: 'hello world' }] }),
      },
      env
    );

    expect(response.status).toBe(403);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('preserves collection query parameters when deleting indexed documents', async () => {
    const token = await createAdminToken();
    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { deleted: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const app = createApp();
    const response = await app.request(
      'https://example.com/api/v1/rag/index/doc-1?collection=posts',
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      env
    );

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(upstreamFetch.mock.calls[0]?.[0]).toBe(
      'https://backend.example/api/v1/rag/index/doc-1?collection=posts'
    );
  });
});
