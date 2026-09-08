import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const manifest = {
  items: Array.from({ length: 15 }, (_, index) => ({
    path: `/posts/2026/runtime-${index + 1}.md`,
    year: '2026',
    slug: `runtime-${index + 1}`,
    title: `Runtime ${String(index + 1).padStart(2, '0')}`,
    description: 'Recovery fixture',
    date: '2026-09-08',
    category: 'Tech',
    tags: ['runtime'],
  })),
};
const query = {
  page: 2,
  pageSize: 12,
  category: 'Tech',
  tags: ['runtime'],
  search: 'Runtime',
  sort: 'title' as const,
};
const strict = { throwOnError: true };

describe('discovery failures through the real post service', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('rejects manifest 503 in discovery and recovers the same filtered page without clearing caches', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const posts = await import('@/data/content/posts');

    await expect(posts.getPostsPage(query, strict)).rejects.toThrow('Failed to load posts manifest');
    await expect(posts.getPosts(strict)).rejects.toThrow();
    await expect(posts.getPostCategoryCounts(strict)).rejects.toThrow();
    await expect(posts.getTags(strict)).rejects.toThrow();
    await expect(posts.getAllCategories(strict)).rejects.toThrow();
    await expect(posts.getAllTags(strict)).rejects.toThrow();

    // Defaults remain compatible for related posts, SEO, and workspace readers.
    await expect(posts.getPosts()).resolves.toEqual([]);
    await expect(posts.getPostsPage(query)).resolves.toMatchObject({ items: [], page: 2 });
    await expect(posts.getPostCategoryCounts()).resolves.toEqual({});
    await expect(posts.getTags()).resolves.toEqual([]);
    await expect(posts.getAllCategories()).resolves.toEqual([]);
    await expect(posts.getAllTags()).resolves.toEqual([]);

    fetchMock.mockResolvedValue({ ok: true, json: async () => manifest });
    await expect(posts.getPostsPage(query, strict)).resolves.toMatchObject({
      total: 15,
      page: 2,
      totalPages: 2,
      items: [{ title: 'Runtime 13' }, { title: 'Runtime 14' }, { title: 'Runtime 15' }],
    });
    await expect(posts.getPosts(strict)).resolves.toHaveLength(15);
    await expect(posts.getPostCategoryCounts(strict)).resolves.toEqual({ Tech: 15 });
    await expect(posts.getAllCategories(strict)).resolves.toEqual(['Tech']);
    await expect(posts.getAllTags(strict)).resolves.toEqual(['runtime']);
    expect(fetchMock).toHaveBeenCalledWith('/posts-manifest.json', { cache: 'no-cache' });
  });

  it.each(['network', 'json', '404'])('rejects %s failures without turning a later valid catalog into cached empty data', async failure => {
    if (failure === 'network') fetchMock.mockRejectedValue(new TypeError('Network unavailable'));
    else if (failure === 'json') fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } });
    else fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const { PostService } = await import('@/services/content/postService');
    await expect(PostService.getPostsPage(query)).rejects.toThrow();
    fetchMock.mockResolvedValue({ ok: true, json: async () => manifest });
    await expect(PostService.getPostsPage(query)).resolves.toMatchObject({ total: 15, page: 2 });
  });

  it('keeps a valid empty manifest successful for every discovery reader', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    const posts = await import('@/data/content/posts');
    await expect(posts.getPostsPage(query, strict)).resolves.toMatchObject({ items: [], total: 0 });
    await expect(posts.getPosts(strict)).resolves.toEqual([]);
    await expect(posts.getAllCategories(strict)).resolves.toEqual([]);
    await expect(posts.getAllTags(strict)).resolves.toEqual([]);
    await expect(posts.getPostCategoryCounts(strict)).resolves.toEqual({});
    await expect(posts.getTags(strict)).resolves.toEqual([]);
  });

  it('preserves the legacy manifest path and markdown fallback', async () => {
    fetchMock.mockImplementation(async (url: string) => url.endsWith('posts-manifest.json')
      ? { ok: true, json: async () => ({ posts: ['/posts/2026/legacy.md'] }) }
      : { ok: true, text: async () => '---\ntitle: Legacy post\ndate: 2026-09-08\ncategory: Tech\ntags: [legacy]\n---\nLegacy content' });
    const { getPostsPage } = await import('@/data/content/posts');
    await expect(getPostsPage({ pageSize: 12 }, strict)).resolves.toMatchObject({
      total: 1,
      items: [{ title: 'Legacy post', slug: 'legacy' }],
    });
    expect(fetchMock).toHaveBeenCalledWith('/posts/2026/legacy.md');
  });
});
