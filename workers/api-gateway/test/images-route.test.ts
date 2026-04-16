import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import images from '../src/routes/images';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv
    extends Pick<Env, 'JWT_SECRET' | 'ALLOWED_ORIGINS' | 'ENV' | 'KV' | 'R2' | 'BACKEND_ORIGIN'> {}
}

async function createUserToken() {
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

function createApp() {
  const app = new Hono();
  app.route('/api/v1/images', images);
  return app;
}

beforeEach(() => {
  env.ALLOWED_ORIGINS = 'https://blog.example';
  env.BACKEND_ORIGIN = 'https://backend.example';
});

describe('images chat-upload hardening', () => {
  it('requires authentication before accepting chat uploads', async () => {
    const app = createApp();
    const formData = new FormData();
    formData.append('file', new File(['png'], 'chat.png', { type: 'image/png' }));

    const response = await app.request(
      'https://example.com/api/v1/images/chat-upload',
      {
        method: 'POST',
        headers: {
          Origin: 'https://blog.example',
        },
        body: formData,
      },
      env
    );

    expect(response.status).toBe(401);
  });

  it('rejects requests without an Origin header even when authenticated', async () => {
    const app = createApp();
    const token = await createUserToken();
    const formData = new FormData();
    formData.append('file', new File(['png'], 'chat.png', { type: 'image/png' }));

    const response = await app.request(
      'https://example.com/api/v1/images/chat-upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
      env
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: {
        message: 'Forbidden - Origin header required',
      },
    });
  });
});
