import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import memos from '../src/routes/memos';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'DB' | 'JWT_SECRET' | 'ENV'> {}
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/memos', memos);
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

async function putMemo(userId: string, body: object) {
  const token = await createUserToken(userId);
  return createApp().request(
    'https://example.com/api/v1/memos',
    {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
    env
  );
}

describe('memo optimistic locking', () => {
  it('requires the current expectedVersion when updating an existing memo', async () => {
    const userId = `memo-user-${crypto.randomUUID()}`;

    const created = await putMemo(userId, {
      content: 'initial',
      createVersion: true,
      expectedVersion: 0,
    });
    expect(created.status).toBe(201);

    const stale = await putMemo(userId, {
      content: 'stale update',
      createVersion: true,
      expectedVersion: 0,
    });
    expect(stale.status).toBe(409);

    const current = await putMemo(userId, {
      content: 'current update',
      createVersion: true,
      expectedVersion: 1,
    });
    expect(current.status).toBe(200);
    expect(await current.json()).toMatchObject({
      ok: true,
      data: { version: 2 },
    });
  });

  it('stores a version snapshot of the previous content before replacing memo content', async () => {
    const userId = `memo-user-${crypto.randomUUID()}`;
    const token = await createUserToken(userId);

    const created = await putMemo(userId, {
      content: 'before',
      createVersion: true,
      expectedVersion: 0,
    });
    expect(created.status).toBe(201);

    const updated = await putMemo(userId, {
      content: 'after',
      createVersion: true,
      expectedVersion: 1,
    });
    expect(updated.status).toBe(200);

    const version = await createApp().request(
      'https://example.com/api/v1/memos/versions/1',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      env
    );

    expect(version.status).toBe(200);
    const payload = (await version.json()) as {
      ok: boolean;
      data: { version: { content: string; version: number } };
    };
    expect(payload.data.version.version).toBe(1);
    expect(payload.data.version.content).toBe('before');
  });
});
