import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionStore } from '../src/session-store.js';

test('in-memory session store rejects duplicate active sessions per user', async () => {
  const previousRedisUrl = process.env.REDIS_URL;
  delete process.env.REDIS_URL;

  try {
    const store = await createSessionStore();
    await store.connect();

    assert.equal(store.kind, 'memory');

    const first = await store.claimSession(
      {
        sessionId: 'session-1',
        userId: 'user-1',
        clientIP: '127.0.0.1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        state: 'claimed',
      },
      60,
    );
    assert.deepEqual(first, { ok: true });

    const second = await store.claimSession(
      {
        sessionId: 'session-2',
        userId: 'user-1',
        clientIP: '127.0.0.1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        state: 'claimed',
      },
      60,
    );
    assert.equal(second.ok, false);

    await store.releaseSession('session-1', 'user-1');

    const retry = await store.claimSession(
      {
        sessionId: 'session-3',
        userId: 'user-1',
        clientIP: '127.0.0.1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        state: 'claimed',
      },
      60,
    );
    assert.deepEqual(retry, { ok: true });

    await store.close();
  } finally {
    if (previousRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = previousRedisUrl;
    }
  }
});

test('redis session store release is owner-fenced and cannot clear a newer user mapping', async () => {
  class FakeRedisClient {
    isOpen = true;
    data = new Map<string, string>();

    async connect() {}
    async quit() {}
    async ping() { return 'PONG'; }
    async get(key: string) { return this.data.get(key) ?? null; }
    async keys(pattern: string) {
      const prefix = pattern.replace('*', '');
      return Array.from(this.data.keys()).filter((key) => key.startsWith(prefix));
    }
    async mGet(keys: string[]) { return keys.map((key) => this.data.get(key) ?? null); }
    async eval(script: string, input: { keys: string[]; arguments: string[] }) {
      const [userKey, sessionKey] = input.keys;
      const [sessionId, sessionJson, ttlSeconds] = input.arguments;
      void ttlSeconds;

      if (script.includes("return {1, 'claimed'}")) {
        const current = this.data.get(userKey);
        if (current && current !== sessionId) {
          return [0, 'user-session-active'];
        }
        this.data.set(userKey, sessionId);
        this.data.set(sessionKey, sessionJson);
        return [1, 'claimed'];
      }

      if (script.includes('current_session_id == session_id')) {
        if (this.data.get(userKey) === sessionId) {
          this.data.delete(userKey);
        }
        this.data.delete(sessionKey);
        return 1;
      }

      if (script.includes('current_session_id ~= session_id')) {
        if (this.data.get(userKey) !== sessionId) {
          return 0;
        }
        this.data.set(userKey, sessionId);
        this.data.set(sessionKey, sessionJson);
        return 1;
      }

      throw new Error('Unexpected Lua script');
    }
  }

  const { RedisSessionStore } = await import('../src/session-store.js');
  const client = new FakeRedisClient();
  const store = new RedisSessionStore(client);

  await store.claimSession(
    {
      sessionId: 'old-session',
      userId: 'user-1',
      clientIP: '127.0.0.1',
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      state: 'claimed',
    },
    60,
  );

  client.data.set('terminal:user:user-1', 'new-session');
  client.data.set(
    'terminal:session:new-session',
    JSON.stringify({
      sessionId: 'new-session',
      userId: 'user-1',
      clientIP: '127.0.0.1',
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      state: 'claimed',
    }),
  );

  await store.releaseSession('old-session', 'user-1');

  assert.equal(client.data.get('terminal:user:user-1'), 'new-session');
  assert.equal(client.data.has('terminal:session:old-session'), false);
  assert.equal(client.data.has('terminal:session:new-session'), true);
});
