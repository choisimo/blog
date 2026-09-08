import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useIsBookmarked } from '@/hooks/content/useBookmarks';
import { addBookmark, getBookmarkIds, toggleBookmark } from '@/services/session/bookmarks';

beforeEach(() => localStorage.clear());
describe('real browser bookmark storage', () => {
  it('keeps encoded Korean and spaced post slugs in the same persisted collection', () => {
    const korean = '2025/감동을_잃어버린_그대들에게';
    expect(toggleBookmark(encodeURIComponent(korean))).toBe(true);
    addBookmark('2026/Container Network Interface');
    expect(getBookmarkIds()).toEqual([korean, '2026/Container Network Interface']);
    expect(toggleBookmark(korean)).toBe(false);
    expect(getBookmarkIds()).toEqual(['2026/Container Network Interface']);
  });
  it('rejects traversal and protocols while accepting existing post paths', () => {
    for (const id of ['2026/../secret', '2026/./secret', 'https://example.com', 'bad id', '2026/bad%0Aid']) expect(toggleBookmark(id)).toBe(false);
    expect(getBookmarkIds()).toEqual([]);
  });
  it('refreshes a reused reader when its post changes and when another tab clears storage', () => {
    addBookmark('2026/knowledge');
    const { result, rerender } = renderHook(({ id }) => useIsBookmarked(id), { initialProps: { id: '2026/knowledge' } });
    expect(result.current.bookmarked).toBe(true);
    rerender({ id: '2026/c-lang-2' });
    expect(result.current.bookmarked).toBe(false);
    act(() => { result.current.toggleBookmark(); });
    expect(result.current.bookmarked).toBe(true);
    act(() => { localStorage.removeItem('blog.bookmarks'); window.dispatchEvent(new StorageEvent('storage', { key: 'blog.bookmarks' })); });
    expect(result.current.bookmarked).toBe(false);
  });
});
