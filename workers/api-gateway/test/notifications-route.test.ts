import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import notifications from '../src/routes/notifications';
import { clearSecretsCache } from '../src/lib/secrets';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv
    extends Pick<
      Env,
      'DB' | 'JWT_SECRET' | 'BACKEND_ORIGIN' | 'BACKEND_KEY' | 'ENV' | 'ALLOWED_ORIGINS'
    > {}
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
  clearSecretsCache();
  env.BACKEND_ORIGIN = 'https://backend.example';
  env.BACKEND_KEY = 'comments-backend-key';
});

describe('notifications route proxy', () => {
  it('drops the incoming Host header before forwarding to the backend', async () => {
    const token = await createUserToken();
    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { unreadCount: 0, items: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const app = new Hono();
    app.route('/api/v1/notifications', notifications);

    const response = await app.request(
      'https://example.com/api/v1/notifications/unread?limit=5',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: 'https://nodove.com',
          Host: 'attacker.example',
          'CF-Connecting-IP': '203.0.113.9',
        },
      },
      env
    );

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);

    const [upstreamUrl, requestInit] = upstreamFetch.mock.calls[0] ?? [];
    const forwardedHeaders = new Headers(requestInit?.headers);

    expect(upstreamUrl).toBe('https://backend.example/api/v1/notifications/unread?limit=5');
    expect(forwardedHeaders.get('Host')).toBeNull();
    expect(forwardedHeaders.get('X-Backend-Key')).toBe('comments-backend-key');
    expect(forwardedHeaders.get('X-Forwarded-For')).toBe('203.0.113.9');
    expect(forwardedHeaders.get('X-Real-IP')).toBe('203.0.113.9');
  });
});
