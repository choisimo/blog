const STORAGE_KEY = 'blog.bookmarks';
const MAX_BOOKMARK_ID_LENGTH = 180;
const BOOKMARK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,179}$/;

export type BookmarkItem = {
  id: string;
  addedAt: number;
};

type BookmarkUpdateDetail = {
  postId?: string;
  bookmarked?: boolean;
  cleared?: boolean;
};

function decodeBookmarkId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

function normalizeBookmarkId(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = decodeBookmarkId(value);
  if (
    !normalized ||
    normalized.length > MAX_BOOKMARK_ID_LENGTH ||
    !BOOKMARK_ID_PATTERN.test(normalized) ||
    normalized.includes('//') ||
    normalized.includes('/../') ||
    normalized.startsWith('../') ||
    normalized.endsWith('/..')
  ) {
    return null;
  }

  return normalized;
}

function normalizeAddedAt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

function normalizeBookmarkItem(item: unknown): BookmarkItem | null {
  if (typeof item === 'string') {
    const id = normalizeBookmarkId(item);
    return id ? { id, addedAt: Date.now() } : null;
  }

  if (!item || typeof item !== 'object') return null;

  const id = normalizeBookmarkId((item as BookmarkItem).id);
  const addedAt = normalizeAddedAt((item as BookmarkItem).addedAt);
  return id && addedAt !== null ? { id, addedAt } : null;
}

function compactBookmarks(items: BookmarkItem[]): BookmarkItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function parse(raw: string | null): BookmarkItem[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return compactBookmarks(
        data
          .map(normalizeBookmarkItem)
          .filter((item): item is BookmarkItem => Boolean(item))
      );
    }
    return [];
  } catch {
    return [];
  }
}

function readStoredBookmarks(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function dispatchBookmarkUpdate(detail: BookmarkUpdateDetail): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent('bookmarks:update', { detail }));
}

function writeBookmarks(items: BookmarkItem[], detail: BookmarkUpdateDetail): boolean {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    dispatchBookmarkUpdate(detail);
    return true;
  } catch {
    return false;
  }
}

function removeStoredBookmarks(detail: BookmarkUpdateDetail): boolean {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    dispatchBookmarkUpdate(detail);
    return true;
  } catch {
    return false;
  }
}

export function getBookmarks(): BookmarkItem[] {
  if (typeof window === 'undefined') return [];
  return parse(readStoredBookmarks());
}

export function getBookmarkIds(): string[] {
  return getBookmarks().map(b => b.id);
}

export function isBookmarked(postId: string): boolean {
  const normalizedPostId = normalizeBookmarkId(postId);
  return normalizedPostId ? getBookmarkIds().includes(normalizedPostId) : false;
}

export function toggleBookmark(postId: string): boolean {
  const normalizedPostId = normalizeBookmarkId(postId);
  if (!normalizedPostId) return false;

  const current = getBookmarks();
  const exists = current.some(b => b.id === normalizedPostId);

  const next = exists
    ? current.filter(b => b.id !== normalizedPostId)
    : [...current, { id: normalizedPostId, addedAt: Date.now() }];

  const didPersist = writeBookmarks(next, { postId: normalizedPostId, bookmarked: !exists });
  return didPersist ? !exists : exists;
}

export function addBookmark(postId: string): void {
  const normalizedPostId = normalizeBookmarkId(postId);
  if (!normalizedPostId || isBookmarked(normalizedPostId)) return;

  const current = getBookmarks();
  const next = [...current, { id: normalizedPostId, addedAt: Date.now() }];
  writeBookmarks(next, { postId: normalizedPostId, bookmarked: true });
}

export function removeBookmark(postId: string): void {
  const normalizedPostId = normalizeBookmarkId(postId);
  if (!normalizedPostId) return;

  const current = getBookmarks();
  const next = current.filter(b => b.id !== normalizedPostId);
  writeBookmarks(next, { postId: normalizedPostId, bookmarked: false });
}

export function clearBookmarks(): void {
  removeStoredBookmarks({ cleared: true });
}
