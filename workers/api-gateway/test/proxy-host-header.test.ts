import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../src/types';
import { signJwt } from '../src/lib/jwt';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'BACKEND_ORIGIN' | 'BACKEND_KEY' | 'JWT_SECRET'> {}
}

afterEach(() => {
  vi.restoreAllMocks();
  env.BACKEND_ORIGIN = 'https://backend.example';
  env.BACKEND_KEY = 'comments-backend-key';
});

describe('generic backend proxy', () => {
  it('guards agent paths and does not expose execute paths through the public backend proxy', async () => {
    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 204,
      })
    );

    const agentResponse = await SELF.fetch('https://example.com/api/v1/agent/run', {
      method: 'POST',
    });
    const executeResponse = await SELF.fetch('https://example.com/api/v1/execute', {
      method: 'POST',
    });

    expect(agentResponse.status).toBe(401);
    expect(executeResponse.status).toBe(404);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('proxies authenticated admin agent requests through the origin boundary', async () => {
    const token = await signJwt(
      {
        sub: 'admin-user',
        role: 'admin',
        username: 'admin',
        type: 'access',
        emailVerified: true,
      },
      env
    );
    const upstreamFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(null, { status: 204 }));

    const response = await SELF.fetch('https://example.com/api/v1/agent/run', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Reply exactly AGENT_OK',
        sessionId: 'agent-test',
        mode: 'default',
      }),
    });

    expect(response.status).toBe(204);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);

    const [upstreamUrl, requestInit] = upstreamFetch.mock.calls[0] ?? [];
    const forwardedHeaders = new Headers(requestInit?.headers);

    expect(upstreamUrl).toBe('https://backend.example/api/v1/agent/run');
    expect(forwardedHeaders.get('Authorization')).toBe(`Bearer ${token}`);
    expect(forwardedHeaders.get('X-Backend-Key')).toBe('comments-backend-key');
  });

  it('does not overwrite Host while forwarding backend-owned paths', async () => {
    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 204,
      })
    );

    const response = await SELF.fetch('https://example.com/api/v1/posts', {
      headers: {
        Host: 'attacker.example',
        'CF-Connecting-IP': '203.0.113.10',
      },
    });

    expect(response.status).toBe(204);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);

    const [upstreamUrl, requestInit] = upstreamFetch.mock.calls[0] ?? [];
    const forwardedHeaders = new Headers(requestInit?.headers);

    expect(upstreamUrl).toBe('https://backend.example/api/v1/posts');
    expect(forwardedHeaders.get('Host')).toBeNull();
    expect(forwardedHeaders.get('X-Backend-Key')).toBe('comments-backend-key');
    expect(forwardedHeaders.get('X-Forwarded-For')).toBe('203.0.113.10');
  });

  it('strips client-supplied origin and model override headers before proxying', async () => {
    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 204,
      })
    );

    const response = await SELF.fetch('https://example.com/api/v1/posts', {
      headers: {
        'X-Backend-Key': 'client-key',
        'X-Internal-Gateway-Key': 'client-internal',
        'X-AI-Model': 'client-model',
        'X-AI-Vision-Model': 'client-vision-model',
      },
    });

    expect(response.status).toBe(204);
    const [, requestInit] = upstreamFetch.mock.calls[0] ?? [];
    const forwardedHeaders = new Headers(requestInit?.headers);

    expect(forwardedHeaders.get('X-Backend-Key')).toBe('comments-backend-key');
    expect(forwardedHeaders.get('X-Internal-Gateway-Key')).toBeNull();
    expect(forwardedHeaders.get('X-AI-Model')).toBeNull();
    expect(forwardedHeaders.get('X-AI-Vision-Model')).toBeNull();
  });

  it('relays backend streaming responses through the proxy', async () => {
    const token = await signJwt(
      {
        sub: 'admin-user',
        role: 'admin',
        username: 'admin',
        type: 'access',
        emailVerified: true,
      },
      env
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response('event: ping\ndata: {"ok":true}\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
    );

    const response = await SELF.fetch('https://example.com/api/v1/admin/logs/stream', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    await expect(response.text()).resolves.toBe('event: ping\ndata: {"ok":true}\n\n');
  });
});
