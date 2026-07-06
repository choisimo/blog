import { useCallback, useEffect, useState } from 'react';

export type VisitedPostItem = {
  path: string;
  title: string;
  coverImage?: string;
  year: string;
  slug: string;
};

export const STORAGE_KEY = 'visited.posts';
const VISITED_ANSI_ESCAPE_PATTERN =
  /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;
const VISITED_CONTROL_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;
const VISITED_CONTROL_REPLACE_PATTERN = /[\u0000-\u001F\u007F-\u009F]+/g;
const UNSAFE_VISITED_SEGMENT_PATTERN = /[\\/#?]/;

function decodeVisitedValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function normalizeVisitedLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const stripped = value.replace(VISITED_ANSI_ESCAPE_PATTERN, '').trim();
  const withoutControls = stripped.replace(VISITED_CONTROL_REPLACE_PATTERN, ' ');
  const decoded = decodeVisitedValue(withoutControls);
  if (
    !withoutControls ||
    !decoded ||
    VISITED_CONTROL_PATTERN.test(decoded)
  ) {
    return null;
  }

  const normalized = withoutControls.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function hasUnsafePathSegment(path: string): boolean {
  return path
    .split('/')
    .some((segment) => segment === '.' || segment === '..');
}

export function normalizeVisitedPathSegment(value: unknown): string | null {
  const segment = normalizeVisitedLabel(value);
  if (!segment || UNSAFE_VISITED_SEGMENT_PATTERN.test(segment)) return null;

  const decoded = decodeVisitedValue(segment);
  if (
    !decoded ||
    decoded === '.' ||
    decoded === '..' ||
    VISITED_CONTROL_PATTERN.test(decoded) ||
    UNSAFE_VISITED_SEGMENT_PATTERN.test(decoded)
  ) {
    return null;
  }

  return segment;
}

function normalizeVisitedPath(
  value: unknown,
  year: string,
  slug: string
): string | null {
  const path = normalizeVisitedLabel(value);
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null;

  const decoded = decodeVisitedValue(path);
  if (
    !decoded ||
    decoded.includes('\\') ||
    hasUnsafePathSegment(decoded) ||
    decoded !== `/blog/${year}/${slug}`
  ) {
    return null;
  }

  return `/blog/${year}/${slug}`;
}

function normalizeVisitedCoverImage(value: unknown): string | undefined {
  const url = normalizeVisitedLabel(value);
  if (!url) return undefined;

  const decoded = decodeVisitedValue(url);
  if (!decoded || decoded.includes('\\')) return undefined;

  if (url.startsWith('/') && !url.startsWith('//')) {
    return hasUnsafePathSegment(decoded) ? undefined : url;
  }

  try {
    const parsed = new URL(url);
    return !hasUnsafePathSegment(parsed.pathname) &&
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.username &&
      !parsed.password
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeVisitedPostItem(item: unknown): VisitedPostItem | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Partial<VisitedPostItem>;
  const title = normalizeVisitedLabel(record.title);
  const year = normalizeVisitedPathSegment(record.year);
  const slug = normalizeVisitedPathSegment(record.slug);
  const path =
    year && slug ? normalizeVisitedPath(record.path, year, slug) : null;
  if (!path || !title || !year || !slug) return null;

  const coverImage = normalizeVisitedCoverImage(record.coverImage);
  return {
    path,
    title,
    year,
    slug,
    ...(coverImage ? { coverImage } : {}),
  };
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
      const validItems = parsed.flatMap((item) => {
        const normalized = normalizeVisitedPostItem(item);
        return normalized ? [normalized] : [];
      });
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
