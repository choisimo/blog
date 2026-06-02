import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIG_REGISTRY,
  listPublicRuntimeConfigKeys,
  listWorkerDynamicConfigKeys,
  validateConfigRegistry,
} from '../src/contracts/config-registry.js';

test('config registry validates required metadata and invariants', () => {
  assert.equal(validateConfigRegistry().length, 0);
  assert.ok(CONFIG_REGISTRY.length > 100);
});

test('public runtime registry excludes deprecated browser secret path', () => {
  assert.ok(!listPublicRuntimeConfigKeys().includes('VITE_CHAT_API_KEY'));
});

test('worker dynamic config excludes secret-like API key writes', () => {
  assert.deepEqual(
    listWorkerDynamicConfigKeys().filter((key) => /KEY|SECRET|TOKEN|PASSWORD/.test(key)),
    [],
  );
});
