import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PostService } from '@/services/postService';

// Utility to create a minimal fetch Response
const jsonResponse = (data: unknown, init: ResponseInit = { status: 200 }) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

const textResponse = (data: string, init: ResponseInit = { status: 200 }) =>
  new Response(data, init);

describe('PostService.prefetchPost', () => {
  const manifest = {
    total: 1,
    items: [
      {
        path: '/posts/2025/test.md',
        year: '2025',
        slug: 'test',
        title: 'Test',
        description: 'Desc',
        snippet: 'Desc',
        date: '2025-01-01',
        tags: ['a'],
        category: 'Cat',
        author: 'Admin',
        readingTime: '1 min read',
        published: true,
      },
    ],
    generatedAt: new Date().toISOString(),
    years: ['2025'],
  };

  const markdown = '# Test\n\nHello';

  beforeEach(() => {
    PostService.clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('caches markdown and avoids duplicate markdown fetches on subsequent prefetch', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch' as any)
      .mockImplementation((url: RequestInfo | URL) => {
        const href = String(url);
        if (href.endsWith('/posts-manifest.json'))
          return Promise.resolve(jsonResponse(manifest));
        if (href.endsWith('/posts/2025/test.md'))
          return Promise.resolve(textResponse(markdown));
        return Promise.resolve(new Response('', { status: 404 }));
      });

    await PostService.prefetchPost('2025', 'test');

    // Expected: 1 manifest + 1 markdown fetch
    const firstMarkdownCalls = fetchMock.mock.calls.filter(c =>
      String(c[0]).endsWith('/posts/2025/test.md')
    ).length;
    expect(firstMarkdownCalls).toBe(1);

    // Second prefetch should be a no-op for markdown
    await PostService.prefetchPost('2025', 'test');

    const markdownCalls = fetchMock.mock.calls.filter(c =>
      String(c[0]).endsWith('/posts/2025/test.md')
    ).length;
    expect(markdownCalls).toBe(1);

    // Manifest should be fetched only once due to manifestCache
    const manifestCalls = fetchMock.mock.calls.filter(c =>
      String(c[0]).endsWith('/posts-manifest.json')
    ).length;
    expect(manifestCalls).toBe(1);
  });

  it('uses cached markdown when getPostBySlug is called after prefetch', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch' as any)
      .mockImplementation((url: RequestInfo | URL) => {
        const href = String(url);
        if (href.endsWith('/posts-manifest.json'))
          return Promise.resolve(jsonResponse(manifest));
        if (href.endsWith('/posts/2025/test.md'))
          return Promise.resolve(textResponse(markdown));
        return Promise.resolve(new Response('', { status: 404 }));
      });

    await PostService.prefetchPost('2025', 'test');

    // markdown fetched once during prefetch
    expect(
      fetchMock.mock.calls.filter(c =>
        String(c[0]).endsWith('/posts/2025/test.md')
      ).length
    ).toBe(1);

    // now getPostBySlug should not fetch markdown again (still only 1 markdown fetch)
    const post = await PostService.getPostBySlug('2025', 'test');
    expect(post?.slug).toBe('test');

    expect(
      fetchMock.mock.calls.filter(c =>
        String(c[0]).endsWith('/posts/2025/test.md')
      ).length
    ).toBe(1);
  });
});
