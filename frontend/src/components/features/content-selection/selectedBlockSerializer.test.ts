import { describe, expect, it } from 'vitest';

import {
  MAX_SELECTED_BLOCK_CHARS,
  buildSelectedBlockFallbackPrompt,
  createSelectedBlockAttachment,
  normalizeSelectedBlockLine,
  normalizeSelectedBlockMarkdown,
  normalizeSelectedBlockSourceUrl,
} from './selectedBlockSerializer';

describe('selectedBlockSerializer sanitizers', () => {
  it('strips ANSI and control characters from single-line fields', () => {
    expect(normalizeSelectedBlockLine('\u001b[31mPost\nTitle\u001b[0m\u0000')).toBe(
      'Post Title',
    );
  });

  it('strips ANSI while preserving safe markdown line breaks', () => {
    expect(
      normalizeSelectedBlockMarkdown('\u001b[32m# Heading\r\nBody\u001b[0m\u0000'),
    ).toBe('# Heading\nBody');
  });

  it('accepts safe URLs and rejects unsafe encoded separators or credentials', () => {
    expect(normalizeSelectedBlockSourceUrl('/posts/dev')).toBe('/posts/dev');
    expect(normalizeSelectedBlockSourceUrl('https://example.com/post')).toBe(
      'https://example.com/post',
    );
    expect(normalizeSelectedBlockSourceUrl('/posts%2Fdev')).toBeUndefined();
    expect(normalizeSelectedBlockSourceUrl('https://user@example.com/post')).toBeUndefined();
  });
});

describe('selected block serialization', () => {
  it('creates sanitized attachments from selected-block event payloads', () => {
    const attachment = createSelectedBlockAttachment({
      markdown: '\u001b[31m```ts\nconsole.log("x")\n```\u001b[0m\u0000',
      text: '\u001b[32mconsole.log\u001b[0m\u0000',
      title: '\u001b[33mPost title\u001b[0m',
      url: 'javascript:alert(1)',
      post: {
        year: '2026',
        slug: 'safe-post',
      },
    });

    expect(attachment).toMatchObject({
      kind: 'selected-block',
      name: 'selected-block.md',
      contentType: 'text/markdown',
      markdown: '```ts\nconsole.log("x")\n```',
      textPreview: 'console.log',
      truncated: false,
      persistRaw: false,
      source: {
        title: 'Post title',
        year: '2026',
        slug: 'safe-post',
      },
    });
    expect(attachment?.source.url).toBeUndefined();
  });

  it('truncates oversized markdown after normalizing selected text', () => {
    const attachment = createSelectedBlockAttachment({
      markdown: `\u001b[31m${'x'.repeat(MAX_SELECTED_BLOCK_CHARS + 1)}\u001b[0m`,
    });

    expect(attachment?.truncated).toBe(true);
    expect(attachment?.markdown).toHaveLength(
      MAX_SELECTED_BLOCK_CHARS + '\n...(truncated)'.length,
    );
  });

  it('uses sanitized message overrides before building fallback prompts', () => {
    expect(
      buildSelectedBlockFallbackPrompt({
        message: '\u001b[31mExplain\nthis\u001b[0m\u0000',
        markdown: 'ignored',
      }),
    ).toBe('Explain this');
  });
});
