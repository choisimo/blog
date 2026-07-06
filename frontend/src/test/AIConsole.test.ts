import { describe, expect, it } from 'vitest';

import { normalizeConsoleCitation } from '@/components/features/console/AIConsole';

describe('AIConsole helpers', () => {
  it('normalizes citation metadata from search results', () => {
    expect(
      normalizeConsoleCitation({
        id: ' cite-1\r\nInjected ',
        title: ' Title\nHere ',
        url: ' https://example.com/post ',
        slug: ' slug\nvalue ',
        year: ' 2026 ',
        snippet: ' Snippet\u0000 text ',
        score: Number.NaN,
        category: ' Category\r\nName ',
      }),
    ).toEqual({
      id: 'cite-1 Injected',
      title: 'Title Here',
      url: 'https://example.com/post',
      slug: 'slug value',
      year: '2026',
      snippet: 'Snippet text',
      score: 0,
      category: 'Category Name',
    });
  });

  it('removes unsafe citation URLs while preserving safe metadata', () => {
    expect(
      normalizeConsoleCitation({
        id: 'cite-2',
        title: 'Unsafe URL',
        url: 'javascript:alert(1)',
        snippet: 'text',
        score: 1,
      }),
    ).toEqual({
      id: 'cite-2',
      title: 'Unsafe URL',
      snippet: 'text',
      score: 1,
    });
  });

  it('rejects encoded citation separators, credentialed urls, and ANSI-contaminated metadata', () => {
    expect(
      normalizeConsoleCitation({
        id: '\u001B[31mcite-3\u001B[0m',
        title: '\u001B[31mEncoded Slug\u001B[0m',
        url: 'https://user@example.com/post',
        slug: 'bad%2Fslug',
        year: '2026',
        snippet: '\u001B[31mSnippet\u001B[0m',
        score: 0.5,
      }),
    ).toEqual({
      id: 'cite-3',
      title: 'Encoded Slug',
      year: '2026',
      snippet: 'Snippet',
      score: 0.5,
    });
  });
});
