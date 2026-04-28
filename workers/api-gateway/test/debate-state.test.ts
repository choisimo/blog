import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import debate from '../src/routes/debate';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'DB' | 'JWT_SECRET' | 'ENV'> {}
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
});
