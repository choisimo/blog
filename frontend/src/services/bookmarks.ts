const STORAGE_KEY = 'blog.bookmarks';

export type BookmarkItem = {
  id: string;
  addedAt: number;
};

function parse(raw: string | null): BookmarkItem[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      if (typeof data[0] === 'string') {
        return data.map(id => ({ id, addedAt: Date.now() }));
      }
      return data as BookmarkItem[];
    }
    return [];
  } catch {
    return [];
  }
}

export function getBookmarks(): BookmarkItem[] {
  if (typeof window === 'undefined') return [];
  return parse(localStorage.getItem(STORAGE_KEY));
}

export function getBookmarkIds(): string[] {
  return getBookmarks().map(b => b.id);
}

export function isBookmarked(postId: string): boolean {
  return getBookmarkIds().includes(postId);
}

export function toggleBookmark(postId: string): boolean {
  const current = getBookmarks();
  const exists = current.some(b => b.id === postId);

  const next = exists
    ? current.filter(b => b.id !== postId)
    : [...current, { id: postId, addedAt: Date.now() }];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('bookmarks:update', { detail: { postId, bookmarked: !exists } }));

  return !exists;
}

export function addBookmark(postId: string): void {
  if (isBookmarked(postId)) return;
  const current = getBookmarks();
  const next = [...current, { id: postId, addedAt: Date.now() }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('bookmarks:update', { detail: { postId, bookmarked: true } }));
}

export function removeBookmark(postId: string): void {
  const current = getBookmarks();
  const next = current.filter(b => b.id !== postId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('bookmarks:update', { detail: { postId, bookmarked: false } }));
}

export function clearBookmarks(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('bookmarks:update', { detail: { cleared: true } }));
}
