import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AI_DEFAULT_MODEL = 'nodove-mspark-1.3c';

const { configSchema } = await import('../src/config/schema.js');

test('image generation has a dedicated default without changing the general AI model', () => {
  const parsed = configSchema.parse({
    APP_ENV: 'test',
    AI_DEFAULT_MODEL: 'nodove-mspark-1.3c',
  });

  assert.equal(parsed.AI_DEFAULT_MODEL, 'nodove-mspark-1.3c');
  assert.equal(parsed.AI_IMAGE_MODEL, 'gpt-5.6-sol');
});
