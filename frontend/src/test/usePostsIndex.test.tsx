import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePostsIndex } from '@/hooks/content/usePostsIndex';
import type { BlogPost } from '@/types/blog';

const postsMocks = vi.hoisted(() => ({
  getPosts: vi.fn(),
}));

vi.mock('@/data/content/posts', () => ({
  getPosts: postsMocks.getPosts,
}));

const post = {
  id: 'safe-post',
  year: '2026',
  slug: 'safe-post',
  title: 'Safe Post',
  description: 'Safe post fixture',
  date: '2026-07-03',
  author: 'nodove',
  category: 'Tech',
  tags: [],
  content: '',
  language: 'ko',
} as BlogPost;

function PostsIndexProbe() {
  const { loading, getPostBySlug } = usePostsIndex();

  if (loading) return <div>loading</div>;

  return (
    <div>
      <div data-testid='safe'>
        {getPostBySlug(' 2026 ', ' safe-post ')?.title ?? 'none'}
      </div>
      <div data-testid='encoded-separator'>
        {getPostBySlug('2026', 'safe%2Fpost')?.title ?? 'none'}
      </div>
      <div data-testid='control'>
        {getPostBySlug('2026\u0000', 'safe-post')?.title ?? 'none'}
      </div>
      <div data-testid='malformed'>
        {getPostBySlug('2026', 'broken%zz')?.title ?? 'none'}
      </div>
    </div>
  );
}

describe('usePostsIndex selector boundaries', () => {
  beforeEach(() => {
    postsMocks.getPosts.mockReset();
    postsMocks.getPosts.mockResolvedValue([post]);
  });

  it('normalizes safe in-memory lookups and rejects unsafe selectors', async () => {
    render(<PostsIndexProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('safe')).toHaveTextContent('Safe Post');
    });

    expect(screen.getByTestId('encoded-separator')).toHaveTextContent('none');
    expect(screen.getByTestId('control')).toHaveTextContent('none');
    expect(screen.getByTestId('malformed')).toHaveTextContent('none');
  });
});
