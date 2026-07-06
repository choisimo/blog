import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  normalizeVisitedLabel,
  normalizeVisitedPathSegment,
  normalizeVisitedPostItem,
  useVisitedPostsState,
} from './useVisitedPosts';

describe('visited posts sanitizers', () => {
  it('strips ANSI and control characters from visited display labels', () => {
    expect(normalizeVisitedLabel('\u001b[31mSafe\npost\u001b[0m\u0000')).toBe(
      'Safe post'
    );
  });

  it('normalizes path segments while rejecting encoded controls and separators', () => {
    expect(normalizeVisitedPathSegment('\u001b[32msafe-post\u001b[0m')).toBe(
      'safe-post'
    );
    expect(normalizeVisitedPathSegment('bad%0Aslug')).toBeNull();
    expect(normalizeVisitedPathSegment('bad%2Fslug')).toBeNull();
  });

  it('normalizes persisted visited post items before state hydration', () => {
    expect(
      normalizeVisitedPostItem({
        path: '/blog/2026/safe-post',
        title: '\u001b[31mSafe\npost\u001b[0m\u0000',
        year: '2026',
        slug: 'safe-post',
        coverImage: '\u001b[32mhttps://example.com/cover.jpg\u001b[0m',
      })
    ).toEqual({
      path: '/blog/2026/safe-post',
      title: 'Safe post',
      year: '2026',
      slug: 'safe-post',
      coverImage: 'https://example.com/cover.jpg',
    });
  });
});

describe('useVisitedPostsState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hydrates only canonical visited blog paths with safe path segments', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          path: '/blog/2026/safe-post',
          title: '\u001b[31mSafe\npost\u001b[0m\u0000',
          year: '2026',
          slug: 'safe-post',
          coverImage: 'https://example.com/cover.jpg',
        },
        {
          path: '/blog/2026/hidden-post',
          title: 'Encoded slash post',
          year: '2026',
          slug: 'hidden%2Fpost',
        },
        {
          path: '/blog/2026/../admin',
          title: 'Traversal post',
          year: '2026',
          slug: 'admin',
        },
        {
          path: '/blog/2026/other-post',
          title: 'Mismatched post',
          year: '2026',
          slug: 'safe-post',
        },
      ])
    );

    const { result } = renderHook(() => useVisitedPostsState());

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
    expect(result.current.items[0]).toEqual({
      path: '/blog/2026/safe-post',
      title: 'Safe post',
      year: '2026',
      slug: 'safe-post',
      coverImage: 'https://example.com/cover.jpg',
    });
    expect(result.current.storageAvailable).toBe(true);
  });

  it('drops unsafe cover images while preserving otherwise safe visited posts', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          path: '/blog/2026/safe-post',
          title: 'Safe post',
          year: '2026',
          slug: 'safe-post',
          coverImage: 'https://user:pass@example.com/cover.jpg',
        },
      ])
    );

    const { result } = renderHook(() => useVisitedPostsState());

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
    expect(result.current.items[0]).not.toHaveProperty('coverImage');
  });
});
