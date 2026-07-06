import { describe, expect, it } from 'vitest';

import {
  MAX_SELECTED_BLOCK_CHARS,
  buildSelectedBlockFallbackPrompt,
  createSelectedBlockAttachment,
} from '@/components/features/content-selection/selectedBlockSerializer';

describe('selectedBlockSerializer', () => {
  it('normalizes selected block markdown, preview, and source metadata', () => {
    const attachment = createSelectedBlockAttachment({
      markdown: ' # Title\u0000\r\nBody ',
      text: ' Title\u0000\nBody ',
      url: 'javascript:alert(1)',
      title: ' Post\u0000\nTitle ',
      post: {
        year: '2026',
        slug: 'unsafe/slug',
      },
    } as any);

    expect(attachment).toMatchObject({
      markdown: '# Title \nBody',
      textPreview: 'Title Body',
      source: {
        url: undefined,
        title: 'Post Title',
        year: '2026',
        slug: undefined,
      },
    });
  });

  it('builds fallback prompts from normalized source and markdown fields', () => {
    const prompt = buildSelectedBlockFallbackPrompt({
      markdown: ' selected\u0000\r\nmarkdown ',
      url: '/blog/2026/post',
      post: {
        title: ' Safe\u0000\nTitle ',
        year: '2026',
        slug: 'safe-slug',
      },
    } as any);

    expect(prompt).toContain('[현재 글] Safe Title');
    expect(prompt).toContain('[경로] 2026/safe-slug');
    expect(prompt).toContain('selected \nmarkdown');
    expect(prompt).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/);
  });

  it('rejects encoded controls and separators in source metadata', () => {
    const attachment = createSelectedBlockAttachment({
      markdown: 'selected',
      url: '/blog/2026/post%00x',
      post: {
        year: '2026',
        slug: 'safe%2Fslug',
      },
    } as any);

    expect(attachment?.source).toMatchObject({
      url: undefined,
      year: '2026',
      slug: undefined,
    });

    expect(
      createSelectedBlockAttachment({
        markdown: 'selected',
        url: 'https://user@example.com/blog/2026/post',
        post: { year: '2026', slug: '%E0%A4%A' },
      } as any)?.source,
    ).toMatchObject({
      url: undefined,
      slug: undefined,
    });
  });

  it('normalizes direct fallback messages and truncates long selected markdown', () => {
    expect(
      buildSelectedBlockFallbackPrompt({
        message: ' Explain\u0000\nthis ',
        markdown: 'ignored',
      } as any),
    ).toBe('Explain this');

    const attachment = createSelectedBlockAttachment({
      markdown: 'x'.repeat(MAX_SELECTED_BLOCK_CHARS + 20),
    } as any);

    expect(attachment?.truncated).toBe(true);
    expect(attachment?.markdown).toEndWith('\n...(truncated)');
  });
});
