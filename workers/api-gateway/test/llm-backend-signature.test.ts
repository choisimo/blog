import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../src/types';
import { callTaskLLM } from '../src/lib/llm';

declare module 'cloudflare:test' {
  interface ProvidedEnv
    extends Pick<
      Env,
      'BACKEND_ORIGIN' | 'BACKEND_KEY' | 'GATEWAY_SIGNING_SECRET' | 'AI_DEFAULT_MODEL'
    > {}
}

afterEach(() => {
  vi.restoreAllMocks();
  env.BACKEND_ORIGIN = 'https://backend.example';
  env.BACKEND_KEY = 'test-backend-key';
  env.GATEWAY_SIGNING_SECRET = 'test-signing-secret';
  env.AI_DEFAULT_MODEL = undefined;
});

describe('backend LLM origin signature', () => {
  it('signs direct backend generate calls from worker-native AI tasks', async () => {
    env.BACKEND_ORIGIN = 'https://backend.example';
    env.BACKEND_KEY = 'test-backend-key';
    env.GATEWAY_SIGNING_SECRET = 'test-signing-secret';

    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ text: '{"items":[]}' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await callTaskLLM(
      {
        system: 'system prompt',
        user: 'user prompt',
        temperature: 0.2,
        maxTokens: 64,
      },
      env
    );

    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    const [upstreamUrl, requestInit] = upstreamFetch.mock.calls[0] ?? [];
    const headers = new Headers(requestInit?.headers);

    expect(upstreamUrl).toBe('https://backend.example/api/v1/ai/generate');
    expect(headers.get('X-Backend-Key')).toBe('test-backend-key');
    expect(headers.get('X-Origin-Verified-By')).toBe('api-gateway');
    expect(headers.get('X-Gateway-Signature-Version')).toBe('v1');
    expect(headers.get('X-Gateway-Timestamp')).toBeTruthy();
    expect(headers.get('X-Gateway-Request-ID')).toBeTruthy();
    expect(headers.get('X-Gateway-Signature')).toMatch(/^v1:[0-9a-f]{64}$/);
  });
});
