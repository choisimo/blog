import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import memories from '../src/routes/memories';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv
    extends Pick<Env, 'DB' | 'JWT_SECRET' | 'BACKEND_ORIGIN' | 'BACKEND_KEY'> {}
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/memories', memories);
  return app;
}

async function createUserToken() {
  return signJwt(
    {
      sub: 'user-1',
      role: 'user',
      username: 'user',
      type: 'access',
    },
    env
  );
}

beforeEach(async () => {
  await env.DB.prepare(`DELETE FROM user_memories WHERE user_id = ?`).bind('user-1').run();
  await env.DB.prepare(`DELETE FROM domain_outbox`).run().catch(() => undefined);
  env.BACKEND_ORIGIN = 'https://backend.example';
  env.BACKEND_KEY = 'backend-test-key';
});

describe('memories outbox atomic writes', () => {
  it('creates the source memory row and its outbox event in the same request', async () => {
    const app = createApp();
    const token = await createUserToken();

    const response = await app.request(
      'https://example.com/api/v1/memories/user-1',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Remember this',
          memoryType: 'fact',
          category: 'test',
        }),
      },
      env
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as { data: { id: string } };

    const memoryRow = await env.DB.prepare(
      `SELECT id FROM user_memories WHERE id = ? AND user_id = ?`
    )
      .bind(payload.data.id, 'user-1')
      .first<{ id: string }>();
    const outboxRow = await env.DB.prepare(
      `SELECT aggregate_id, event_type FROM domain_outbox WHERE aggregate_id = ?`
    )
      .bind(payload.data.id)
      .first<{ aggregate_id: string; event_type: string }>();

    expect(memoryRow?.id).toBe(payload.data.id);
    expect(outboxRow).toMatchObject({
      aggregate_id: payload.data.id,
      event_type: 'memory.embedding.upsert',
    });
  });

  it('does not enqueue a delete outbox event when the memory does not exist', async () => {
    const app = createApp();
    const token = await createUserToken();

    const response = await app.request(
      'https://example.com/api/v1/memories/user-1/mem-missing',
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      env
    );

    expect(response.status).toBe(404);

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM domain_outbox`
    ).first<{ total: number }>();

    expect(Number(countRow?.total || 0)).toBe(0);
  });
});
