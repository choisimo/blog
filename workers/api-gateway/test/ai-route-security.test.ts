import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import ai from '../src/routes/ai';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'JWT_SECRET' | 'ENV' | 'KV' | 'BACKEND_ORIGIN'> {}
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/ai', ai);
  return app;
}

async function createUserToken() {
  return signJwt(
    {
      sub: 'user-ai-1',
      role: 'user',
      username: 'user-ai',
      type: 'access',
    },
    env
  );
}

describe('AI route security guards', () => {
  it('rejects unauthenticated paid generation requests', async () => {
    const response = await createApp().request(
      'https://example.com/api/v1/ai/generate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' }),
      },
      env
    );

    expect(response.status).toBe(401);
  });

  it('rejects oversized authenticated prompts before backend AI calls', async () => {
    const token = await createUserToken();
    const response = await createApp().request(
      'https://example.com/api/v1/ai/generate',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: 'x'.repeat(16001) }),
      },
      env
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { message: 'prompt is too large' },
    });
  });
});
