import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import worker from '../src/index';
import type { Env } from '../src/types';
import {
  attachOriginSignatureHeaders,
  attachOriginSignatureHeadersForUrl,
} from '../src/lib/origin-signature';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<
    Env,
    'ENV' | 'BACKEND_ORIGIN' | 'BACKEND_KEY' | 'GATEWAY_SIGNING_SECRET' | 'JWT_SECRET'
  > {}
}

afterEach(() => {
  vi.restoreAllMocks();
  env.ENV = 'development';
  env.BACKEND_ORIGIN = 'https://backend.example';
  env.BACKEND_KEY = 'comments-backend-key';
  env.GATEWAY_SIGNING_SECRET = undefined;
});

describe('origin signature configuration', () => {
  it('fails closed in protected environments when the signing secret is missing', async () => {
    const headers = new Headers();

    await expect(
      attachOriginSignatureHeaders({
        env: {
          ENV: 'production',
        } as Env,
        headers,
        method: 'GET',
        pathAndQuery: '/api/v1/posts',
      })
    ).rejects.toMatchObject({
      code: 'ORIGIN_SIGNATURE_CONFIG_MISSING',
    });

    expect(headers.get('X-Gateway-Signature')).toBeNull();
  });

  it('keeps unsigned development requests opt-in when no signing secret is configured', async () => {
    const headers = new Headers();

    await expect(
      attachOriginSignatureHeaders({
        env: {
          ENV: 'development',
        } as Env,
        headers,
        method: 'GET',
        pathAndQuery: '/api/v1/posts',
      })
    ).resolves.toBeNull();

    expect(headers.get('X-Gateway-Signature')).toBeNull();
  });

  it('derives the signed payload path and query from a backend URL', async () => {
    const headers = new Headers();

    await attachOriginSignatureHeadersForUrl({
      env: {
        ENV: 'production',
        GATEWAY_SIGNING_SECRET: 'test-signing-secret',
      } as Env,
      headers,
      method: 'GET',
      url: 'https://backend.example/api/v1/analytics/all-stats?limit=10',
      now: new Date('2026-05-01T00:00:00.000Z'),
    });

    expect(headers.get('X-Origin-Verified-By')).toBe('api-gateway');
    expect(headers.get('X-Gateway-Signature')).toMatch(/^v1:[0-9a-f]{64}$/);
  });
});

describe('scheduled backend calls', () => {
  it('signs cron refresh and editor-picks backend requests', async () => {
    env.ENV = 'production';
    env.BACKEND_ORIGIN = 'https://backend.example';
    env.BACKEND_KEY = 'cron-backend-key';
    env.GATEWAY_SIGNING_SECRET = 'test-signing-secret';

    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (url.includes('/api/v1/analytics/refresh-stats')) {
        return new Response(JSON.stringify({ ok: true, data: { refreshed: 1 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/v1/analytics/all-stats')) {
        return new Response(JSON.stringify({ ok: true, data: { stats: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/v1/ai/queue-stats')) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { enabled: false, asyncMode: false, queueLength: 0, dlqLength: 0 },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await worker.scheduled({} as ScheduledEvent, env as Env, {} as ExecutionContext);

    const analyticsCalls = upstreamFetch.mock.calls.filter(([input]) => {
      const url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      return url.includes('/api/v1/analytics/');
    });

    expect(analyticsCalls).toHaveLength(2);
    for (const [, init] of analyticsCalls) {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-Backend-Key')).toBe('cron-backend-key');
      expect(headers.get('X-Origin-Verified-By')).toBe('api-gateway');
      expect(headers.get('X-Gateway-Signature-Version')).toBe('v1');
      expect(headers.get('X-Gateway-Timestamp')).toBeTruthy();
      expect(headers.get('X-Gateway-Request-ID')).toBeTruthy();
      expect(headers.get('X-Gateway-Signature')).toMatch(/^v1:[0-9a-f]{64}$/);
    }
  });
});
