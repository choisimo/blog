import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addBookmark,
  clearBookmarks,
  getBookmarkIds,
  getBookmarks,
  removeBookmark,
  toggleBookmark,
} from '@/services/session/bookmarks';

describe('bookmarks service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('filters invalid stored bookmarks and normalizes legacy string entries', () => {
    localStorage.setItem(
      'blog.bookmarks',
      JSON.stringify([
        '2026/post-one',
        { id: '2026/post-two', addedAt: 10.8 },
        { id: '../escape', addedAt: 11 },
        { id: '2026/post-two', addedAt: 12 },
        { id: 'bad id', addedAt: 13 },
      ]),
    );

    expect(getBookmarks()).toEqual([
      { id: '2026/post-one', addedAt: expect.any(Number) },
      { id: '2026/post-two', addedAt: 10 },
    ]);
    expect(getBookmarkIds()).toEqual(['2026/post-one', '2026/post-two']);
  });

  it('keeps storage write failures non-fatal and returns the persisted toggle state', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'QuotaExceededError');
      });

    expect(() => addBookmark('2026/post-one')).not.toThrow();
    expect(toggleBookmark('2026/post-one')).toBe(false);
    expect(setItemSpy).toHaveBeenCalled();
  });

  it('returns the existing bookmark state when removing cannot be persisted', () => {
    addBookmark('2026/post-one');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'QuotaExceededError');
    });

    expect(toggleBookmark('2026/post-one')).toBe(true);
    expect(getBookmarkIds()).toEqual(['2026/post-one']);
  });

  it('keeps remove and clear operations best-effort', () => {
    const removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

    expect(() => removeBookmark('2026/post-one')).not.toThrow();
    expect(() => clearBookmarks()).not.toThrow();
    expect(removeItemSpy).toHaveBeenCalled();
  });
});
