import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import chat from '../src/routes/chat';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<
    Env,
    | 'DB'
    | 'KV'
    | 'JWT_SECRET'
    | 'ENV'
    | 'BACKEND_ORIGIN'
    | 'BACKEND_KEY'
    | 'GATEWAY_SIGNING_SECRET'
    | 'AI_DEFAULT_MODEL'
  > {}
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/chat', chat);
  return app;
}

async function createUserToken() {
  return signJwt(
    {
      sub: 'chat-user-1',
      role: 'user',
      username: 'chat-user',
      type: 'access',
    },
    env
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  env.BACKEND_ORIGIN = undefined;
  env.BACKEND_KEY = undefined;
  env.GATEWAY_SIGNING_SECRET = undefined;
  env.AI_DEFAULT_MODEL = undefined;
});

describe('chat route rate-limit resilience', () => {
  it('keeps chat validation available when KV rate-limit writes are exhausted', async () => {
    vi.spyOn(env.KV, 'put').mockRejectedValue(new Error('KV write quota exhausted'));

    const token = await createUserToken();
    const response = await createApp().request(
      'https://example.com/api/v1/chat/session/session-1/lens-feed',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      },
      env
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('X-RateLimit-Storage')).toBe('degraded');
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { message: 'No content provided for lens feed' },
    });
  });
});
