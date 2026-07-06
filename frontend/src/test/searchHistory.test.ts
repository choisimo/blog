import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addSearchQuery,
  clearSearchHistory,
  getRecentQueries,
  removeSearchQuery,
} from '@/services/session/searchHistory';

describe('searchHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('normalizes control characters and deduplicates stored queries', () => {
    addSearchQuery(' deep\u0000\nsearch ');
    addSearchQuery('DEEP SEARCH');

    expect(getRecentQueries()).toEqual(['DEEP SEARCH']);
  });

  it('drops invalid stored items when reading recent queries', () => {
    localStorage.setItem(
      'blog.searchHistory',
      JSON.stringify([
        { query: ' valid\u0000\nquery ', timestamp: 10.8 },
        { query: '\u0000', timestamp: 11 },
        { query: 'old query', timestamp: -1 },
        { query: 'valid query', timestamp: 12 },
      ]),
    );

    expect(getRecentQueries()).toEqual(['valid query']);
  });

  it('keeps storage write failures non-fatal', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'QuotaExceededError');
      });

    expect(() => addSearchQuery('safe query')).not.toThrow();
    expect(setItemSpy).toHaveBeenCalled();
  });

  it('keeps remove and clear operations best-effort', () => {
    const removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

    expect(() => removeSearchQuery('safe query')).not.toThrow();
    expect(() => clearSearchHistory()).not.toThrow();
    expect(removeItemSpy).toHaveBeenCalled();
  });
});
