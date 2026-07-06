import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBookmarks, useIsBookmarked } from '@/hooks/content/useBookmarks';

const bookmarkMocks = vi.hoisted(() => ({
  getBookmarkIds: vi.fn(),
  isBookmarked: vi.fn(),
  toggleBookmark: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

vi.mock('@/services/session/bookmarks', () => ({
  getBookmarkIds: bookmarkMocks.getBookmarkIds,
  isBookmarked: bookmarkMocks.isBookmarked,
  toggleBookmark: bookmarkMocks.toggleBookmark,
  addBookmark: bookmarkMocks.addBookmark,
  removeBookmark: bookmarkMocks.removeBookmark,
}));

function BookmarkProbe({ postId }: { postId: string }) {
  const bookmarks = useBookmarks();
  const single = useIsBookmarked(postId);

  return (
    <div>
      <div data-testid='count'>{bookmarks.count}</div>
      <div data-testid='list-state'>
        {bookmarks.isBookmarked(postId) ? 'listed' : 'unlisted'}
      </div>
      <div data-testid='single-state'>
        {single.bookmarked ? 'bookmarked' : 'not-bookmarked'}
      </div>
      <button type='button' onClick={() => bookmarks.toggleBookmark(postId)}>
        Toggle list
      </button>
      <button type='button' onClick={() => single.toggleBookmark()}>
        Toggle single
      </button>
    </div>
  );
}

describe('useBookmarks hook boundaries', () => {
  beforeEach(() => {
    bookmarkMocks.getBookmarkIds.mockReset();
    bookmarkMocks.isBookmarked.mockReset();
    bookmarkMocks.toggleBookmark.mockReset();
    bookmarkMocks.addBookmark.mockReset();
    bookmarkMocks.removeBookmark.mockReset();
    bookmarkMocks.getBookmarkIds.mockReturnValue([
      '2026/safe-post',
      'bad%0aid',
      '2026/../secret',
    ]);
    bookmarkMocks.isBookmarked.mockReturnValue(true);
    bookmarkMocks.toggleBookmark.mockReturnValue(true);
  });

  it('normalizes bookmark ids and post ids before comparisons and service calls', () => {
    render(<BookmarkProbe postId=' 2026%2Fsafe-post ' />);

    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('list-state')).toHaveTextContent('listed');
    expect(bookmarkMocks.isBookmarked).toHaveBeenCalledWith('2026/safe-post');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle single' }));

    expect(bookmarkMocks.toggleBookmark).toHaveBeenCalledWith('2026/safe-post');
    expect(bookmarkMocks.toggleBookmark).toHaveBeenCalledTimes(2);
  });

  it('does not call bookmark services for unsafe hook post ids', () => {
    render(<BookmarkProbe postId='2026/../secret' />);

    expect(screen.getByTestId('list-state')).toHaveTextContent('unlisted');
    expect(screen.getByTestId('single-state')).toHaveTextContent(
      'not-bookmarked'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle single' }));

    expect(bookmarkMocks.isBookmarked).not.toHaveBeenCalled();
    expect(bookmarkMocks.toggleBookmark).not.toHaveBeenCalled();
  });
});
