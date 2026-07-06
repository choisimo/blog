import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateRSSFeed, generateSitemap } from '@/utils/seo/sitemap';

const getPostsMock = vi.hoisted(() => vi.fn());

vi.mock('@/data/content/posts', () => ({
  getPosts: getPostsMock,
}));

describe('sitemap and RSS output boundaries', () => {
  afterEach(() => {
    getPostsMock.mockReset();
    vi.unstubAllEnvs();
  });

  it('escapes XML text and skips unsafe post URL segments', async () => {
    vi.stubEnv('VITE_SITE_BASE_URL', 'https://blog.example.com/root/');
    getPostsMock.mockResolvedValue([
      {
        year: '2026',
        slug: 'safe-post',
        date: '2026-07-03',
        title: 'A & <B>\u0000',
        description: 'Description with > and "quotes"',
        category: 'Tech & Ops',
        tags: ['safe', 'bad<tag>'],
      },
      {
        year: '2026',
        slug: 'bad%2Fpost',
        date: '2026-07-03',
        title: 'Unsafe slug',
        description: 'Should be skipped',
        category: 'Tech',
        tags: [],
      },
    ]);

    const sitemap = await generateSitemap();
    const rss = await generateRSSFeed();

    expect(sitemap).toContain(
      '<loc>https://blog.example.com/root/blog/2026/safe-post</loc>'
    );
    expect(sitemap).not.toContain('bad%2Fpost');
    expect(rss).toContain('<title>A &amp; &lt;B&gt;</title>');
    expect(rss).toContain(
      '<description>Description with &gt; and &quot;quotes&quot;</description>'
    );
    expect(rss).toContain('<category>Tech &amp; Ops</category>');
    expect(rss).toContain('<category>bad&lt;tag&gt;</category>');
    expect(rss).not.toContain('Unsafe slug');
  });

  it('consistently rejects repeated control-contaminated base URLs', async () => {
    vi.stubEnv('VITE_SITE_BASE_URL', 'https://bad.example.com/\u0000');
    getPostsMock.mockResolvedValue([]);

    const first = await generateSitemap();
    const second = await generateSitemap();

    expect(first).toContain(
      '<loc>https://blog.nodove.com</loc>'
    );
    expect(second).toContain(
      '<loc>https://blog.nodove.com</loc>'
    );
    expect(first).not.toContain('bad.example.com');
    expect(second).not.toContain('bad.example.com');
  });
});
