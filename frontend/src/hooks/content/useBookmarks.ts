import { useState, useEffect, useCallback } from 'react';
import {
  getBookmarkIds,
  isBookmarked as checkBookmarked,
  toggleBookmark as toggle,
  addBookmark as add,
  removeBookmark as remove,
} from '@/services/session/bookmarks';

const BOOKMARK_HOOK_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const BOOKMARK_HOOK_UNSAFE_DECODED_PATTERN = /[\u0000-\u001F\u007F\\]/;

function normalizeBookmarkHookPostId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || BOOKMARK_HOOK_CONTROL_PATTERN.test(trimmed) || trimmed.includes('\\')) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(trimmed).trim();
    if (!decoded || BOOKMARK_HOOK_UNSAFE_DECODED_PATTERN.test(decoded)) {
      return null;
    }

    const segments = decoded.split('/');
    if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function getSafeBookmarkIds(): string[] {
  return Array.from(
    new Set(
      getBookmarkIds()
        .map(normalizeBookmarkHookPostId)
        .filter((postId): postId is string => Boolean(postId))
    )
  );
}

export function useBookmarks() {
  const [bookmarkIds, setBookmarkIds] = useState<string[]>(() => getSafeBookmarkIds());

  useEffect(() => {
    const handleUpdate = () => setBookmarkIds(getSafeBookmarkIds());
    window.addEventListener('bookmarks:update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('bookmarks:update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const isBookmarked = useCallback((postId: string) => {
    const normalizedPostId = normalizeBookmarkHookPostId(postId);
    return normalizedPostId ? bookmarkIds.includes(normalizedPostId) : false;
  }, [bookmarkIds]);

  const toggleBookmark = useCallback((postId: string) => {
    const normalizedPostId = normalizeBookmarkHookPostId(postId);
    if (!normalizedPostId) return false;
    const result = toggle(normalizedPostId);
    setBookmarkIds(getSafeBookmarkIds());
    return result;
  }, []);

  const addBookmark = useCallback((postId: string) => {
    const normalizedPostId = normalizeBookmarkHookPostId(postId);
    if (!normalizedPostId) return;
    add(normalizedPostId);
    setBookmarkIds(getSafeBookmarkIds());
  }, []);

  const removeBookmark = useCallback((postId: string) => {
    const normalizedPostId = normalizeBookmarkHookPostId(postId);
    if (!normalizedPostId) return;
    remove(normalizedPostId);
    setBookmarkIds(getSafeBookmarkIds());
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
  const normalizedPostId = normalizeBookmarkHookPostId(postId);
  const [bookmarked, setBookmarked] = useState(() =>
    normalizedPostId ? checkBookmarked(normalizedPostId) : false
  );

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const eventPostId =
        typeof detail?.postId === 'string'
          ? normalizeBookmarkHookPostId(detail.postId)
          : null;
      if (detail?.cleared) {
        setBookmarked(false);
      } else if (normalizedPostId && eventPostId === normalizedPostId) {
        setBookmarked(checkBookmarked(normalizedPostId));
      }
    };
    window.addEventListener('bookmarks:update', handleUpdate);
    return () => window.removeEventListener('bookmarks:update', handleUpdate);
  }, [normalizedPostId]);

  const toggleBookmark = useCallback(() => {
    if (!normalizedPostId) return false;
    const result = toggle(normalizedPostId);
    setBookmarked(result);
    return result;
  }, [normalizedPostId]);

  return { bookmarked, toggleBookmark };
}

export default useBookmarks;
