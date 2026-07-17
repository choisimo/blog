import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import internal from '../src/routes/internal';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'R2' | 'BACKEND_KEY' | 'ASSETS_BASE_URL'> {}
}

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/internal', internal);
  return app;
}

async function upload(body: unknown, backendKey = env.BACKEND_KEY) {
  return createApp().request(
    'https://api.example/api/v1/internal/images/generated',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(backendKey ? { 'X-Backend-Key': backendKey } : {}),
      },
      body: JSON.stringify(body),
    },
    env
  );
}

beforeEach(async () => {
  env.BACKEND_KEY = 'generated-image-backend-key';
  env.ASSETS_BASE_URL = 'https://assets.example';
  await env.R2.delete('images/2026/release-checklist/ai/generated-test.png');
});

describe('internal generated image storage', () => {
  it('stores a validated raster in R2 and returns its immutable public URL', async () => {
    const key = 'images/2026/release-checklist/ai/generated-test.png';
    const response = await upload({
      key,
      contentType: 'image/png',
      data: bytesToBase64(PNG_BYTES),
    });
    const json = await response.json<{
      ok: boolean;
      data: { key: string; url: string; size: number; contentType: string };
    }>();

    expect(response.status).toBe(201);
    expect(json).toEqual({
      ok: true,
      data: {
        key,
        url: `https://assets.example/${key}`,
        size: PNG_BYTES.byteLength,
        contentType: 'image/png',
      },
    });

    const stored = await env.R2.get(key);
    expect(stored).not.toBeNull();
    expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(PNG_BYTES);
    expect(stored!.httpMetadata?.contentType).toBe('image/png');
  });

  it('requires the backend key before reading the upload payload', async () => {
    const response = await upload({}, 'wrong-key');

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('rejects traversal keys and content-type extension mismatches', async () => {
    const data = bytesToBase64(PNG_BYTES);
    const [traversal, mismatch] = await Promise.all([
      upload({
        key: 'images/2026/release-checklist/../generated-test.png',
        contentType: 'image/png',
        data,
      }),
      upload({
        key: 'images/2026/release-checklist/ai/generated-test.webp',
        contentType: 'image/png',
        data,
      }),
    ]);

    expect(traversal.status).toBe(400);
    expect(mismatch.status).toBe(400);
  });

  it('rejects data whose magic bytes do not match the declared raster type', async () => {
    const response = await upload({
      key: 'images/2026/release-checklist/ai/generated-test.png',
      contentType: 'image/png',
      data: bytesToBase64(new TextEncoder().encode('<svg></svg>')),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: 'BAD_REQUEST' },
    });
  });
});
