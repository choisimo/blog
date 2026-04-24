import assert from 'node:assert/strict';
import test from 'node:test';

import { checkRateLimit } from '../src/ratelimit';

class MemoryKV {
  store = new Map<string, string>();
  fail = false;

  async get(key: string) {
    if (this.fail) {
      throw new Error('kv unavailable');
    }
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string) {
    if (this.fail) {
      throw new Error('kv unavailable');
    }
    this.store.set(key, value);
  }

  async delete(key: string) {
    if (this.fail) {
      throw new Error('kv unavailable');
    }
    this.store.delete(key);
  }
}

test('checkRateLimit blocks requests after the configured window maximum', async () => {
  const kv = new MemoryKV() as unknown as KVNamespace;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await checkRateLimit('127.0.0.1', kv);
    assert.equal(result.allowed, true);
  }

  const blocked = await checkRateLimit('127.0.0.1', kv);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'limit_exceeded');
  assert.equal(blocked.remaining, 0);
});

test('checkRateLimit fails closed when KV storage is unavailable', async () => {
  const kv = new MemoryKV();
  kv.fail = true;

  const result = await checkRateLimit('127.0.0.1', kv as unknown as KVNamespace);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'kv_unavailable');
  assert.equal(result.remaining, 0);
});
