import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AI_DEFAULT_MODEL ??= 'test-model';

const { extractPartContext, extractUserMessage } = await import(
  '../src/lib/chat-streaming.js'
);
const { deriveUserQuery } = await import('../src/services/session.service.js');

test('chat parts separate user text from selected block context', () => {
  const parts = [
    { type: 'text', purpose: 'system', text: 'system prompt' },
    { type: 'text', purpose: 'context', text: 'page context' },
    {
      type: 'selected-block',
      attachment: {
        kind: 'selected-block',
        name: 'selected-block.md',
        markdown: '## Selected\n\nBody',
        source: { title: 'Article', year: '2026', slug: 'post' },
      },
    },
    { type: 'text', purpose: 'user', text: 'Explain this block' },
  ];

  assert.equal(extractUserMessage(parts), 'Explain this block');
  assert.equal(deriveUserQuery(parts, 'fallback'), 'Explain this block');
  assert.match(extractPartContext(parts), /page context/);
  assert.match(extractPartContext(parts), /Selected block attachment/);
  assert.match(extractPartContext(parts), /## Selected/);
});

test('legacy unmarked text parts still become the user message', () => {
  const parts = [
    { type: 'text', text: 'legacy context' },
    { type: 'text', text: 'legacy question' },
  ];

  assert.equal(extractUserMessage(parts), 'legacy context\nlegacy question');
  assert.equal(deriveUserQuery(parts, ''), 'legacy question');
  assert.equal(extractPartContext(parts), '');
});
