import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'BACKEND_ORIGIN' | 'BACKEND_KEY'> {}
}

afterEach(() => {
  vi.restoreAllMocks();
  env.BACKEND_ORIGIN = 'https://backend.example';
  env.BACKEND_KEY = 'comments-backend-key';
});

describe('generic backend proxy', () => {
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
});
