import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMode,
  isValidAgentMode,
  listAgentModes,
  AGENT_MODE_REGISTRY,
} from './mode-registry.js';

describe('normalizeMode', () => {
  it('returns canonical id unchanged', () => {
    assert.equal(normalizeMode('default'), 'default');
    assert.equal(normalizeMode('research'), 'research');
    assert.equal(normalizeMode('coding'), 'coding');
    assert.equal(normalizeMode('blog'), 'blog');
    assert.equal(normalizeMode('article'), 'article');
    assert.equal(normalizeMode('terminal'), 'terminal');
    assert.equal(normalizeMode('performance'), 'performance');
  });

  it('resolves performance aliases to canonical id', () => {
    assert.equal(normalizeMode('performance_audit'), 'performance');
    assert.equal(normalizeMode('performance-audit'), 'performance');
  });

  it('falls back to default for unknown mode', () => {
    assert.equal(normalizeMode('unknown'), 'default');
    assert.equal(normalizeMode(''), 'default');
    assert.equal(normalizeMode(null), 'default');
    assert.equal(normalizeMode(undefined), 'default');
    assert.equal(normalizeMode('totally_invalid'), 'default');
  });

  it('is case-insensitive for canonical ids', () => {
    assert.equal(normalizeMode('RESEARCH'), 'research');
    assert.equal(normalizeMode('Coding'), 'coding');
    assert.equal(normalizeMode('PERFORMANCE'), 'performance');
  });
});

describe('isValidAgentMode', () => {
  it('accepts canonical ids', () => {
    for (const { id } of AGENT_MODE_REGISTRY) {
      assert.equal(isValidAgentMode(id), true, `Expected ${id} to be valid`);
    }
  });

  it('accepts registered aliases', () => {
    assert.equal(isValidAgentMode('performance_audit'), true);
    assert.equal(isValidAgentMode('performance-audit'), true);
  });

  it('rejects unknown values', () => {
    assert.equal(isValidAgentMode('unknown'), false);
    assert.equal(isValidAgentMode(''), false);
    assert.equal(isValidAgentMode(null), false);
    assert.equal(isValidAgentMode(undefined), false);
  });
});

describe('listAgentModes', () => {
  it('returns one entry per registry definition', () => {
    const modes = listAgentModes();
    assert.equal(modes.length, AGENT_MODE_REGISTRY.length);
  });

  it('only exposes id, name, description — no aliases', () => {
    for (const mode of listAgentModes()) {
      assert.ok('id' in mode);
      assert.ok('name' in mode);
      assert.ok('description' in mode);
      assert.ok(!('aliases' in mode), 'aliases must not be exposed in API response');
    }
  });

  it('includes performance as a canonical entry', () => {
    const ids = listAgentModes().map(m => m.id);
    assert.ok(ids.includes('performance'));
  });

  it('registry ids match listAgentModes ids exactly', () => {
    const registryIds = AGENT_MODE_REGISTRY.map(m => m.id).sort();
    const listedIds = listAgentModes().map(m => m.id).sort();
    assert.deepEqual(listedIds, registryIds);
  });
});
