import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AI_DEFAULT_MODEL = 'gpt-5.3-codex-spark';

const { configSchema } = await import('../src/config/schema.js');

test('image generation has a dedicated default without changing the general AI model', () => {
  const parsed = configSchema.parse({
    APP_ENV: 'test',
    AI_DEFAULT_MODEL: 'gpt-5.3-codex-spark',
  });

  assert.equal(parsed.AI_DEFAULT_MODEL, 'gpt-5.3-codex-spark');
  assert.equal(parsed.AI_IMAGE_MODEL, 'gpt-5.6-sol');
});
