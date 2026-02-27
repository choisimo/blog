import { useState, useEffect, useCallback } from 'react';
import {
  getBookmarkIds,
  isBookmarked as checkBookmarked,
  toggleBookmark as toggle,
  addBookmark as add,
  removeBookmark as remove,
} from '@/services/bookmarks';

export function useBookmarks() {
  const [bookmarkIds, setBookmarkIds] = useState<string[]>(() => getBookmarkIds());

  useEffect(() => {
    const handleUpdate = () => setBookmarkIds(getBookmarkIds());
    window.addEventListener('bookmarks:update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('bookmarks:update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const isBookmarked = useCallback((postId: string) => bookmarkIds.includes(postId), [bookmarkIds]);

  const toggleBookmark = useCallback((postId: string) => {
    const result = toggle(postId);
    setBookmarkIds(getBookmarkIds());
    return result;
  }, []);

  const addBookmark = useCallback((postId: string) => {
    add(postId);
    setBookmarkIds(getBookmarkIds());
  }, []);

  const removeBookmark = useCallback((postId: string) => {
    remove(postId);
    setBookmarkIds(getBookmarkIds());
  }, []);

  return {
    bookmarkIds,
    isBookmarked,
    toggleBookmark,
    addBookmark,
    removeBookmark,
    count: bookmarkIds.length,
  };
}

export function useIsBookmarked(postId: string) {
  const [bookmarked, setBookmarked] = useState(() => checkBookmarked(postId));

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.postId === postId || detail?.cleared) {
        setBookmarked(checkBookmarked(postId));
      }
    };
    window.addEventListener('bookmarks:update', handleUpdate);
    return () => window.removeEventListener('bookmarks:update', handleUpdate);
  }, [postId]);

  const toggleBookmark = useCallback(() => {
    const result = toggle(postId);
    setBookmarked(result);
    return result;
  }, [postId]);

  return { bookmarked, toggleBookmark };
}

export default useBookmarks;
