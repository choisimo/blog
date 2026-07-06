import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadPostService() {
  vi.resetModules();
  const module = await import('@/services/content/postService');
  return module.PostService;
}

describe('post service manifest parsing', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('skips malformed manifest rows before building post pages', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 99,
        generatedAt: 123,
        years: [2026, '2026'],
        categoryCounts: {
          Tech: 1,
          Broken: '2',
        },
        format: '2',
        items: [
          null,
          'not-a-post',
          {
            path: '/posts/ko/2026/runtime-guards.md',
            year: '2026',
            slug: 'runtime-guards',
            title: ' Runtime Guards ',
            description: ' Validate manifest payloads ',
            date: '2026-07-03',
            tags: [' ai ', 123, 'runtime'],
            category: ' Tech ',
            published: true,
          },
        ],
      }),
    });
    const PostService = await loadPostService();

    await expect(PostService.getPostsPage({ pageSize: 10 })).resolves.toMatchObject({
      total: 1,
      items: [
        {
          id: 'runtime-guards',
          title: 'Runtime Guards',
          description: 'Validate manifest payloads',
          date: '2026-07-03',
          tags: ['ai', 'runtime'],
          category: 'Tech',
          slug: 'runtime-guards',
          year: '2026',
        },
      ],
    });
  });

  it('falls back to an empty post page for malformed top-level manifests', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ['not-a-manifest'],
    });
    const PostService = await loadPostService();

    await expect(PostService.getPostsPage({ pageSize: 10 })).resolves.toMatchObject({
      total: 0,
      items: [],
      totalPages: 1,
      hasMore: false,
    });
  });

  it('skips manifest rows with unsafe markdown paths', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            path: '//evil.example/posts/2026/external.md',
            year: '2026',
            slug: 'external',
            title: 'External',
            description: 'External path',
            date: '2026-07-03',
            tags: [],
            category: 'Security',
          },
          {
            path: '/posts/ko/2026/safe-post.md',
            year: '2026',
            slug: 'safe-post',
            title: 'Safe Post',
            description: 'Safe path',
            date: '2026-07-03',
            tags: [],
            category: 'Security',
          },
        ],
      }),
    });
    const PostService = await loadPostService();

    await expect(PostService.getPostsPage({ pageSize: 10 })).resolves.toMatchObject({
      total: 1,
      items: [
        {
          id: 'safe-post',
          title: 'Safe Post',
        },
      ],
    });
  });
});
