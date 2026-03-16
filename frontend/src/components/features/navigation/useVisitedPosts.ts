import { useCallback, useEffect, useState } from 'react';

export type VisitedPostItem = {
  path: string;
  title: string;
  coverImage?: string;
  year: string;
  slug: string;
};

export const STORAGE_KEY = 'visited.posts';

function isVisitedPostItem(item: unknown): item is VisitedPostItem {
  return (
    !!item &&
    typeof item === 'object' &&
    typeof (item as VisitedPostItem).path === 'string' &&
    typeof (item as VisitedPostItem).title === 'string'
  );
}

export function useVisitedPostsState() {
  const [items, setItems] = useState<VisitedPostItem[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);

  const read = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setItems([]);
        setStorageAvailable(true);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        setItems([]);
        setStorageAvailable(true);
        return;
      }
      const validItems = parsed.filter(isVisitedPostItem);
      setItems(validItems);
      setStorageAvailable(true);
    } catch {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      } catch {
        // localStorage completely unavailable
      }
      setItems([]);
      setStorageAvailable(false);
    }
  }, []);

  useEffect(() => {
    read();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === STORAGE_KEY) read();
    };
    const onCustom = () => read();
    const onStorageError = () => {
      setItems([]);
      setStorageAvailable(false);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('visitedposts:update', onCustom as EventListener);
    window.addEventListener('visitedposts:error', onStorageError);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('visitedposts:update', onCustom as EventListener);
      window.removeEventListener('visitedposts:error', onStorageError);
    };
  }, [read]);

  return { items, storageAvailable };
}

export function useVisitedPosts() {
  return useVisitedPostsState().items;
}
