import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDockerArgs,
  getContainerInfo,
  startContainer,
} from '../src/docker.js';

test('buildDockerArgs applies the hardened sandbox flags', () => {
  const args = buildDockerArgs('terminal-user-1', {
    userId: 'user-1',
    image: 'blog-terminal-sandbox',
    cpus: '0.5',
    memory: '128m',
    pidsLimit: 50,
    networkMode: 'none',
    timeout: 600_000,
  });

  assert.equal(args.includes('--security-opt'), true);
  assert.equal(args.includes('no-new-privileges:true'), true);
  assert.equal(args.includes('--cap-drop'), true);
  assert.equal(args.includes('ALL'), true);
  assert.equal(args.includes('--read-only'), true);
});

test('startContainer tracks container metadata without starting docker eagerly', () => {
  const { containerName, args } = startContainer('user-2');
  const info = getContainerInfo(containerName);

  assert.match(containerName, /^terminal-[0-9a-f]{12}-\d+-[a-z0-9]+$/);
  assert.ok(args.length > 0);
  assert.equal(info?.userId, 'user-2');
});
