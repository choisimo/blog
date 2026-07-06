import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  STORAGE_KEY,
  useVisitedPostsState,
} from '@/components/features/navigation/useVisitedPosts';

type HookApi = ReturnType<typeof useVisitedPostsState>;

function Harness({ onReady }: { onReady?: (api: HookApi) => void }) {
  const api = useVisitedPostsState();

  useEffect(() => {
    onReady?.(api);
  });

  return <output data-testid="visited">{JSON.stringify(api)}</output>;
}

describe('useVisitedPostsState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes stored visited post metadata before exposing state', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          path: ' /blog/2026/safe ',
          title: ' Safe Title ',
          year: ' 2026 ',
          slug: ' safe-slug ',
          coverImage: ' https://example.com/cover.png ',
        },
      ]),
    );

    render(<Harness />);

    await waitFor(() => {
      const parsed = JSON.parse(
        screen.getByTestId('visited').textContent || '{}',
      ) as HookApi;
      expect(parsed.items).toEqual([
        {
          path: '/blog/2026/safe',
          title: 'Safe Title',
          year: '2026',
          slug: 'safe-slug',
          coverImage: 'https://example.com/cover.png',
        },
      ]);
      expect(parsed.storageAvailable).toBe(true);
    });
  });

  it('filters unsafe visited post paths and cover images', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          path: 'javascript:alert(1)',
          title: 'Bad',
          year: '2026',
          slug: 'bad',
        },
        {
          path: '/blog/2026/%09bad',
          title: 'Encoded bad path',
          year: '2026',
          slug: 'bad',
        },
        {
          path: '/blog/2026/safe',
          title: 'Safe',
          year: '2026',
          slug: 'safe',
          coverImage: 'https://user:pass@example.com/cover.png',
        },
      ]),
    );

    render(<Harness />);

    await waitFor(() => {
      const parsed = JSON.parse(
        screen.getByTestId('visited').textContent || '{}',
      ) as HookApi;
      expect(parsed.items).toEqual([
        {
          path: '/blog/2026/safe',
          title: 'Safe',
          year: '2026',
          slug: 'safe',
        },
      ]);
    });
  });
});
