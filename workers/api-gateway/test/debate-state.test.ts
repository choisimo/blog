import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import debate from '../src/routes/debate';
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
    > {}
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/debate', debate);
  return app;
}

async function createUserToken(userId: string) {
  return signJwt(
    {
      sub: userId,
      role: 'user',
      username: userId,
      type: 'access',
    },
    env
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  env.BACKEND_ORIGIN = undefined;
  env.BACKEND_KEY = undefined;
  env.GATEWAY_SIGNING_SECRET = undefined;
  env.AI_API_KEY = undefined;
  env.AI_DEFAULT_MODEL = undefined;
});

describe('debate vote state', () => {
  it('dedupes votes by authenticated voter identity and idempotency key', async () => {
    const app = createApp();
    const userId = `debate-user-${crypto.randomUUID()}`;
    const token = await createUserToken(userId);
    const topicId = `topic-${crypto.randomUUID()}`;
    const sessionId = `session-${crypto.randomUUID()}`;

    await env.DB.prepare('INSERT INTO debate_topics (id, title) VALUES (?, ?)')
      .bind(topicId, 'test topic')
      .run();
    await env.DB.prepare('INSERT INTO debate_sessions (id, topic_id, user_id) VALUES (?, ?, ?)')
      .bind(sessionId, topicId, userId)
      .run();

    const idempotencyKey = `vote-${crypto.randomUUID()}`;
    const first = await app.request(
      `https://example.com/api/v1/debate/sessions/${sessionId}/vote`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ roundNumber: 1, votedFor: 'attacker', userId: 'spoofed-user' }),
      },
      env
    );
    const replay = await app.request(
      `https://example.com/api/v1/debate/sessions/${sessionId}/vote`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ roundNumber: 1, votedFor: 'attacker', userId: 'spoofed-user' }),
      },
      env
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true');

    const changed = await app.request(
      `https://example.com/api/v1/debate/sessions/${sessionId}/vote`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': `vote-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ roundNumber: 1, votedFor: 'defender', userId: 'another-spoof' }),
      },
      env
    );

    expect(changed.status).toBe(200);
    const payload = (await changed.json()) as {
      data: { votes: { attacker: number; defender: number } };
    };
    expect(payload.data.votes).toEqual({ attacker: 0, defender: 1 });

    const voteRow = await env.DB.prepare(
      `SELECT user_id, fingerprint_id FROM debate_votes WHERE session_id = ? AND round_number = ?`
    )
      .bind(sessionId, 1)
      .first<{ user_id: string; fingerprint_id: string }>();
    expect(voteRow?.user_id).toBe(userId);
    expect(voteRow?.fingerprint_id).toBe(`user:${userId}`);
  });

  it('generates debate rounds through backend origin AI calls with backend auth', async () => {
    env.BACKEND_ORIGIN = 'https://backend.example';
    env.BACKEND_KEY = 'backend-secret';
    env.GATEWAY_SIGNING_SECRET = 'gateway-signing-secret';
    env.AI_API_KEY = 'ai-secret';
    env.AI_DEFAULT_MODEL = 'gpt-4.1';

    const upstreamFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true, data: { content: 'debate response' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const app = createApp();
    const userId = `debate-user-${crypto.randomUUID()}`;
    const token = await createUserToken(userId);
    const topicId = `topic-${crypto.randomUUID()}`;
    const sessionId = `session-${crypto.randomUUID()}`;

    await env.DB.prepare('INSERT INTO debate_topics (id, title) VALUES (?, ?)')
      .bind(topicId, 'test topic')
      .run();
    await env.DB.prepare('INSERT INTO debate_sessions (id, topic_id, user_id) VALUES (?, ?, ?)')
      .bind(sessionId, topicId, userId)
      .run();

    const response = await app.request(
      `https://example.com/api/v1/debate/sessions/${sessionId}/round`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      env
    );

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledTimes(3);

    for (const [input, init] of upstreamFetch.mock.calls) {
      expect(input).toBe('https://backend.example/api/v1/ai/auto-chat');
      const headers = new Headers(init?.headers);
      expect(headers.get('X-Backend-Key')).toBe('backend-secret');
      expect(headers.get('X-API-KEY')).toBe('ai-secret');
      expect(headers.get('X-Internal-Gateway-Key')).toBe('ai-secret');
      expect(headers.get('X-AI-Model')).toBe('gpt-4.1');
      expect(headers.get('X-Origin-Verified-By')).toBe('api-gateway');
      expect(headers.get('X-Gateway-Signature')).toMatch(/^v1:[0-9a-f]{64}$/);
    }
  });
});
