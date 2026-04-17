import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import adminLogs from '../src/routes/admin-logs';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv
    extends Pick<Env, 'JWT_SECRET' | 'BACKEND_ORIGIN' | 'BACKEND_KEY' | 'OPENCODE_AUTH_TOKEN'> {}
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/admin/logs', adminLogs);
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

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  env.BACKEND_ORIGIN = 'https://backend.example';
  env.BACKEND_KEY = 'admin-logs-backend-key';
  env.OPENCODE_AUTH_TOKEN = 'worker-service-token';
});

describe('admin logs worker proxy', () => {
  it('proxies the historical log list endpoint through the worker', async () => {
    const token = await createAdminToken();
    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { logs: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const app = createApp();
    const response = await app.request(
      'https://example.com/api/v1/admin/logs?level=error&limit=10',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Host: 'attacker.example',
          'CF-Connecting-IP': '203.0.113.7',
        },
      },
      env
    );

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);

    const [upstreamUrl, requestInit] = upstreamFetch.mock.calls[0] ?? [];
    const forwardedHeaders = new Headers(requestInit?.headers);

    expect(upstreamUrl).toBe('https://backend.example/api/v1/admin/logs?level=error&limit=10');
    expect(forwardedHeaders.get('Host')).toBeNull();
    expect(forwardedHeaders.get('X-Backend-Key')).toBe('admin-logs-backend-key');
    expect(forwardedHeaders.get('X-Forwarded-For')).toBe('203.0.113.7');
  });

  it('accepts EventSource-compatible query tokens for the stream endpoint', async () => {
    const token = await createAdminToken();
    env.OPENCODE_AUTH_TOKEN = 'worker-service-token';

    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('data: {"type":"connected"}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const app = createApp();
    const response = await app.request(
      `https://example.com/api/v1/admin/logs/stream?token=${encodeURIComponent(token)}`,
      {
        method: 'GET',
      },
      env
    );

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(upstreamFetch.mock.calls[0]?.[0]).toBe(
      `https://backend.example/api/v1/admin/logs/stream?token=${encodeURIComponent(token)}`
    );
    expect(new Headers(upstreamFetch.mock.calls[0]?.[1]?.headers).get('Authorization')).toBeNull();
  });
});
