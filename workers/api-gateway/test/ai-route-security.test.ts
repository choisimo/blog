import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import { AIService } from '../src/lib/ai-service';
import ai from '../src/routes/ai';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<
    Env,
    'JWT_SECRET' | 'ENV' | 'KV' | 'BACKEND_ORIGIN' | 'AI_VISION_MODEL'
  > {}
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

afterEach(() => {
  vi.restoreAllMocks();
  delete (env as Partial<Env>).AI_VISION_MODEL;
});

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

  it('allows production-length inference before aborting the origin request', async () => {
    const token = await createUserToken();
    const generate = vi.spyOn(AIService.prototype, 'generate').mockResolvedValue('pong');

    const response = await createApp().request(
      'https://example.com/api/v1/ai/generate',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: 'Reply with exactly: pong' }),
      },
      env
    );

    expect(response.status).toBe(200);
    expect(generate).toHaveBeenCalledWith(
      'Reply with exactly: pong',
      expect.objectContaining({ timeout: 120_000 })
    );
  });

  it('keeps AI validation available when KV rate-limit writes are exhausted', async () => {
    const token = await createUserToken();
    vi.spyOn(env.KV, 'put').mockRejectedValue(new Error('KV write quota exhausted'));

    const response = await createApp().request(
      'https://example.com/api/v1/ai/generate',
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
      error: { message: 'prompt is required' },
    });
  });

  it('reports vision as disabled when no vision model is configured', async () => {
    delete (env as Partial<Env>).AI_VISION_MODEL;

    const response = await createApp().request('https://example.com/api/v1/ai/status', {}, env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        features: {
          vision: false,
        },
      },
    });
  });

  it('fails vision analysis before backend calls when no vision model is configured', async () => {
    delete (env as Partial<Env>).AI_VISION_MODEL;
    const token = await createUserToken();
    const upstreamFetch = vi.spyOn(globalThis, 'fetch');

    const response = await createApp().request(
      'https://example.com/api/v1/ai/vision/analyze',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageBase64:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
          mimeType: 'image/png',
        }),
      },
      env
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'VISION_NOT_CONFIGURED' },
    });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });
});
