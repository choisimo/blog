import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'BACKEND_ORIGIN' | 'BACKEND_KEY'> {}
}

let originalFetch: typeof fetch;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return new Response(JSON.stringify(body), { ...init, headers });
}

function installFetchInterception(
  implementation: (url: string, init?: RequestInit) => Promise<Response>
): void {
  originalFetch = globalThis.fetch;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.startsWith(String(env.BACKEND_ORIGIN))) {
      return implementation(url, init);
    }

    return originalFetch(input, init);
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  env.BACKEND_ORIGIN = 'https://backend.example';
  env.BACKEND_KEY = 'comments-backend-key';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('comments route ownership proxy', () => {
  it('proxies comment listing to the backend authoritative route', async () => {
    const upstreamCalls: Array<{ url: string; init?: RequestInit }> = [];

    installFetchInterception(async (url, init) => {
      upstreamCalls.push({ url, init });
      return jsonResponse({
        ok: true,
        data: {
          comments: [
            {
              id: 'comment-1',
              postId: 'post-1',
              author: 'Alice',
              content: 'Hello',
              website: null,
              parentId: null,
              createdAt: '2026-03-30T00:00:00.000Z',
            },
          ],
          total: 1,
        },
      });
    });

    const response = await SELF.fetch(
      'https://example.com/api/v1/comments?postId=post-1'
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: { comments: Array<{ id: string }> };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.comments[0]?.id).toBe('comment-1');

    expect(upstreamCalls).toHaveLength(1);
    expect(upstreamCalls[0]?.url).toBe(
      'https://backend.example/api/v1/comments?postId=post-1'
    );

    const forwardedHeaders = new Headers(upstreamCalls[0]?.init?.headers);
    expect(forwardedHeaders.get('X-Backend-Key')).toBe('comments-backend-key');
  });

  it('forwards comment creation body and device fingerprint header to backend', async () => {
    const upstreamCalls: Array<{
      url: string;
      init?: RequestInit;
      bodyText?: string;
    }> = [];

    installFetchInterception(async (url, init) => {
      let bodyText: string | undefined;
      if (init?.body) {
        const proxiedRequest = new Request(url, {
          method: init.method,
          headers: init.headers,
          body: init.body as BodyInit,
          duplex: 'half',
        } as RequestInit & { duplex: 'half' });
        bodyText = await proxiedRequest.text();
      }

      upstreamCalls.push({ url, init, bodyText });
      return jsonResponse(
        {
          ok: true,
          data: { id: 'comment-2' },
        },
        { status: 201 }
      );
    });

    const response = await SELF.fetch('https://example.com/api/v1/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': 'fp-123',
      },
      body: JSON.stringify({
        postId: 'post-1',
        author: 'Alice',
        content: 'Hello',
      }),
    });

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      ok: boolean;
      data: { id: string };
    };
    expect(payload.data.id).toBe('comment-2');

    expect(upstreamCalls).toHaveLength(1);
    expect(upstreamCalls[0]?.url).toBe('https://backend.example/api/v1/comments');
    expect(upstreamCalls[0]?.init?.method).toBe('POST');

    const forwardedHeaders = new Headers(upstreamCalls[0]?.init?.headers);
    expect(forwardedHeaders.get('X-Backend-Key')).toBe('comments-backend-key');
    expect(forwardedHeaders.get('X-Device-Fingerprint')).toBe('fp-123');
    expect(upstreamCalls[0]?.bodyText).toBe(
      JSON.stringify({
        postId: 'post-1',
        author: 'Alice',
        content: 'Hello',
      })
    );
  });
});
