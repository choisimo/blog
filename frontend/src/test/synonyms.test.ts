import { describe, expect, it } from 'vitest';

import {
  expandQueryWithSynonyms,
  getRelatedKeywords,
  getSynonyms,
  inferCategories,
} from '@/services/discovery/synonyms';

describe('synonyms service', () => {
  it('normalizes control characters before synonym lookup and expansion', () => {
    expect(getSynonyms(' L\u0000\nLM ')).toContain('gpt');

    const expanded = expandQueryWithSynonyms(' L\u0000\nLM guide ');
    expect(expanded[0]).toBe('L LM guide');
    expect(expanded.every(query => !/[\u0000-\u001F\u007F]/.test(query))).toBe(true);
    expect(expanded).toContain('gpt guide');
  });

  it('normalizes related keywords and inferred category checks', () => {
    const keywords = getRelatedKeywords(' React\u0000\nAPI ');
    expect(keywords).toContain('react');
    expect(keywords).toContain('api');
    expect(keywords.every(keyword => !/[\u0000-\u001F\u007F]/.test(keyword))).toBe(true);

    expect(inferCategories(' Cloudflare\u0000 Workers ')).toContain('cloud');
  });
});
