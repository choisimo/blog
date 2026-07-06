import { describe, expect, it } from 'vitest';

import { buildBlogListPostPath } from '@/pages/public/Blog';

describe('Blog page link helpers', () => {
  it('builds safe post links and falls back for unsafe path segments', () => {
    expect(buildBlogListPostPath({ year: '2026', slug: 'safe-post' })).toBe(
      '/blog/2026/safe-post',
    );
    expect(buildBlogListPostPath({ year: '2026', slug: 'safe post' })).toBe(
      '/blog/2026/safe%20post',
    );

    expect(buildBlogListPostPath({ year: '2026', slug: 'bad/slug' })).toBe('/blog');
    expect(buildBlogListPostPath({ year: '2026', slug: 'bad%2fslug' })).toBe('/blog');
    expect(buildBlogListPostPath({ year: '2026', slug: 'bad%09slug' })).toBe('/blog');
    expect(buildBlogListPostPath({ year: '20\u000026', slug: 'safe-post' })).toBe('/blog');
  });
});
