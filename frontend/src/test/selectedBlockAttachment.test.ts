import { describe, expect, it } from 'vitest';

import {
  MAX_SELECTED_BLOCK_CHARS,
  createSelectedBlockAttachment,
} from '@/components/features/content-selection';

describe('selected block attachment serializer', () => {
  it('creates a virtual markdown attachment from legacy selected block payloads', () => {
    const attachment = createSelectedBlockAttachment({
      markdown: '# Title\n\nBody',
      text: 'Title Body',
      title: 'Article',
      url: 'https://example.com/blog/2026/post',
      post: { year: '2026', slug: 'post' },
    });

    expect(attachment).toMatchObject({
      kind: 'selected-block',
      name: 'selected-block.md',
      contentType: 'text/markdown',
      markdown: '# Title\n\nBody',
      textPreview: 'Title Body',
      persistRaw: false,
      source: {
        title: 'Article',
        year: '2026',
        slug: 'post',
      },
    });
    expect(attachment?.sizeBytes).toBeGreaterThan(0);
  });

  it('truncates large blocks before they enter chat state', () => {
    const attachment = createSelectedBlockAttachment({
      markdown: 'a'.repeat(MAX_SELECTED_BLOCK_CHARS + 50),
    });

    expect(attachment?.truncated).toBe(true);
    expect(attachment?.markdown.length).toBeLessThan(
      MAX_SELECTED_BLOCK_CHARS + 30
    );
  });

  it('rejects empty selected blocks', () => {
    expect(createSelectedBlockAttachment({ markdown: '   ' })).toBeNull();
  });
});
