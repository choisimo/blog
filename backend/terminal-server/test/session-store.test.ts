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
