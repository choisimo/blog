import { describe, expect, it } from 'vitest';

import {
  expandQueryWithSynonyms,
  getRelatedKeywords,
  getSynonyms,
  inferCategories,
} from '@/services/discovery/synonyms';

describe('discovery synonyms service', () => {
  it('fails closed for blank and non-string runtime inputs', () => {
    expect(getSynonyms(' \n\t ')).toEqual([]);
    expect(expandQueryWithSynonyms('   ')).toEqual([]);
    expect(getRelatedKeywords(null as unknown as string)).toEqual([]);
    expect(inferCategories(undefined as unknown as string)).toEqual([]);
  });

  it('normalizes whitespace before expanding queries', () => {
    expect(expandQueryWithSynonyms('  DNA   분석  ')[0]).toBe('DNA 분석');
    expect(getRelatedKeywords('  AI   성능  ')).toContain('ai');
  });

  it('bounds very large query inputs before returning candidates', () => {
    const largeQuery = `${'AI '.repeat(200)}tail`;

    const expanded = expandQueryWithSynonyms(largeQuery);
    const related = getRelatedKeywords(largeQuery);

    expect(expanded.every((candidate) => candidate.length <= 300)).toBe(true);
    expect(related.length).toBeLessThanOrEqual(80);
  });
});
