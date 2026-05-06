import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import gateway from '../src/routes/gateway';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv
    extends Pick<
      Env,
      | 'DB'
      | 'KV'
      | 'JWT_SECRET'
      | 'ENV'
      | 'BACKEND_ORIGIN'
      | 'BACKEND_KEY'
      | 'GATEWAY_SIGNING_SECRET'
      | 'AI_API_KEY'
      | 'AI_DEFAULT_MODEL'
      | 'API_BASE_URL'
    > {}
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/gateway', gateway);
  return app;
}

async function createUserToken() {
  return signJwt(
    {
      sub: 'gateway-user-1',
      role: 'user',
      username: 'gateway-user',
      type: 'access',
    },
    env
  );
}

function getFetchRequest(call: unknown[]): Request {
  const input = call[0];
  const init = call[1] as RequestInit | undefined;
  return input instanceof Request ? input : new Request(String(input), init);
}

afterEach(async () => {
  vi.restoreAllMocks();
  await env.KV.delete('config:ai_agent_backend_url');
  env.BACKEND_ORIGIN = undefined;
  env.BACKEND_KEY = undefined;
  env.GATEWAY_SIGNING_SECRET = undefined;
  env.AI_API_KEY = undefined;
  env.AI_DEFAULT_MODEL = undefined;
  env.API_BASE_URL = undefined;
});

describe('AI gateway routes', () => {
  it('proxies auto-chat to the backend origin with backend authentication headers', async () => {
    env.BACKEND_ORIGIN = 'https://backend.example';
    env.BACKEND_KEY = 'backend-secret';
    env.GATEWAY_SIGNING_SECRET = 'gateway-signing-secret';
    env.AI_API_KEY = 'ai-secret';
    env.AI_DEFAULT_MODEL = 'gpt-4.1';
    env.API_BASE_URL = 'https://api.nodove.com';

    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { content: 'ok' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const token = await createUserToken();
    const response = await createApp().request(
      'https://example.com/api/v1/gateway/call/auto-chat',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Backend-Key': 'client-supplied',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
        }),
      },
      env
    );

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);

    const request = getFetchRequest(upstreamFetch.mock.calls[0] ?? []);
    expect(request.url).toBe('https://backend.example/api/v1/ai/auto-chat');
    expect(request.headers.get('X-Backend-Key')).toBe('backend-secret');
    expect(request.headers.get('X-API-KEY')).toBe('ai-secret');
    expect(request.headers.get('X-Internal-Gateway-Key')).toBe('ai-secret');
    expect(request.headers.get('X-AI-Model')).toBe('gpt-4.1');
    expect(request.headers.get('X-Origin-Verified-By')).toBe('api-gateway');
    expect(request.headers.get('X-Gateway-Signature')).toMatch(/^v1:[0-9a-f]{64}$/);
  });

  it('ignores a self-referential gateway backend KV value when backend origin is configured', async () => {
    env.BACKEND_ORIGIN = 'https://backend.example';
    env.API_BASE_URL = 'https://api.nodove.com';
    await env.KV.put('config:ai_agent_backend_url', 'https://api.nodove.com');

    const response = await createApp().request(
      'https://example.com/api/v1/gateway/call/health',
      {},
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        backendUrl: 'https://backend.example',
      },
    });
  });
});
