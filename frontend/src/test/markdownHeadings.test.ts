import { describe, expect, it } from 'vitest';

import {
  buildMarkdownToc,
  normalizeHeadingText,
} from '@/utils/content/markdownHeadings';

describe('markdown heading utilities', () => {
  it('fails closed for non-string runtime inputs', () => {
    expect(normalizeHeadingText(null as unknown as string)).toBe('');
    expect(buildMarkdownToc(null as unknown as string)).toEqual([]);
  });

  it('limits normalized heading text length', () => {
    const normalized = normalizeHeadingText(`# ${'A'.repeat(300)}`);

    expect(normalized).toHaveLength(240);
  });

  it('removes control characters from heading titles before TOC rendering', () => {
    expect(normalizeHeadingText('Intro\u0000Title\u007F\nNext')).toBe(
      'Intro Title Next'
    );
    expect(buildMarkdownToc('## Intro\u0000Title\u007F')).toEqual([
      { id: 'intro-title', title: 'Intro Title', level: 2 },
    ]);
  });

  it('limits generated TOC headings', () => {
    const markdown = Array.from({ length: 150 }, (_, index) => `## Heading ${index}`).join('\n');

    const toc = buildMarkdownToc(markdown);

    expect(toc).toHaveLength(120);
    expect(toc[119]).toMatchObject({
      id: 'heading-119',
      title: 'Heading 119',
      level: 2,
    });
  });

  it('preserves duplicate slug suffixing within the heading limit', () => {
    expect(buildMarkdownToc('## Intro\n## Intro')).toEqual([
      { id: 'intro', title: 'Intro', level: 2 },
      { id: 'intro-1', title: 'Intro', level: 2 },
    ]);
  });
});
