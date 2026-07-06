import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPostBySlug,
  getPostBySlugLegacy,
  prefetchPost,
} from '@/data/content/posts';
import type { BlogPost } from '@/types/blog';

const postServiceMocks = vi.hoisted(() => ({
  getAllPosts: vi.fn(),
  getPostBySlug: vi.fn(),
  prefetchPost: vi.fn(),
}));

vi.mock('@/services/content/postService', () => ({
  PostService: {
    getAllPosts: postServiceMocks.getAllPosts,
    getPostBySlug: postServiceMocks.getPostBySlug,
    prefetchPost: postServiceMocks.prefetchPost,
    getPostsPage: vi.fn(),
    getPostsByCategory: vi.fn(),
    getPostsByTag: vi.fn(),
    searchPosts: vi.fn(),
    getCategoryCounts: vi.fn(),
    clearCache: vi.fn(),
  },
}));

const post = {
  year: '2026',
  slug: 'safe-post',
  title: 'Safe Post',
  description: 'Safe post fixture',
  date: '2026-07-03',
  author: 'nodove',
  category: 'Tech',
  tags: [],
} as BlogPost;

describe('data content post path boundaries', () => {
  beforeEach(() => {
    postServiceMocks.getAllPosts.mockReset();
    postServiceMocks.getPostBySlug.mockReset();
    postServiceMocks.prefetchPost.mockReset();
  });

  it('rejects unsafe direct post path segments before service calls', async () => {
    expect(await getPostBySlug('2026', 'bad%2Fslug')).toBeNull();
    expect(await getPostBySlug('2026\u0000', 'safe-post')).toBeNull();
    await prefetchPost('2026', 'bad\\slug');

    expect(postServiceMocks.getPostBySlug).not.toHaveBeenCalled();
    expect(postServiceMocks.prefetchPost).not.toHaveBeenCalled();
  });

  it('passes trimmed safe post path segments to the service', async () => {
    postServiceMocks.getPostBySlug.mockResolvedValue(post);

    await expect(getPostBySlug(' 2026 ', ' safe-post ')).resolves.toBe(post);

    expect(postServiceMocks.getPostBySlug).toHaveBeenCalledWith(
      '2026',
      'safe-post'
    );
  });

  it('rejects unsafe legacy lookup slugs before loading all posts', async () => {
    expect(await getPostBySlugLegacy('2026/../safe-post')).toBeNull();
    expect(await getPostBySlugLegacy('safe%2Fpost')).toBeNull();
    expect(await getPostBySlugLegacy('broken%zz')).toBeNull();

    expect(postServiceMocks.getAllPosts).not.toHaveBeenCalled();
  });
});
