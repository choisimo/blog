import { describe, expect, it } from 'vitest';
import { buildContextPrompt } from '@/services/chat/context';

describe('chat context prompt boundaries', () => {
  it('bounds single-line article metadata and headings before prompt construction', () => {
    const longTitle = 'T'.repeat(350);
    const longHeading = 'H'.repeat(220);

    const prompt = buildContextPrompt('Article snippet', {
      article: {
        title: longTitle,
        year: '2026',
        slug: 'chat-context-boundary',
        description: 'Description',
        headings: [longHeading],
      },
    });

    expect(prompt).toContain(`제목: ${'T'.repeat(300)}...`);
    expect(prompt).toContain(`주요 섹션: ${'H'.repeat(160)}...`);
    expect(prompt).not.toContain(longTitle);
    expect(prompt).not.toContain(longHeading);
  });

  it('collapses whitespace in article metadata before applying prompt limits', () => {
    const prompt = buildContextPrompt('Article snippet', {
      article: {
        title: '  Title\\nwith\\tspacing  ',
        slug: 'post-slug',
        year: '2026',
      },
    });

    expect(prompt).toContain('제목: Title with spacing');
  });
});
