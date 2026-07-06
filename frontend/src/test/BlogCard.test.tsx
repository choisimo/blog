import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import BlogCard from '@/components/features/blog/BlogCard';

const prefetchPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/data/content/posts', () => ({
  prefetchPost: prefetchPostMock,
}));

vi.mock('@/hooks/i18n/useLanguage', () => ({
  default: () => ({ language: 'en' }),
}));

vi.mock('@/utils/content/blog', () => ({
  formatDate: () => ' July\u0000 3, 2026 ',
  resolveLocalizedPost: (post: any) => post,
}));

vi.mock('@/utils/shared/common', () => ({
  stripMarkdown: (value: string) => value,
}));

vi.mock('@/components/common/OptimizedImage', () => ({
  OptimizedImage: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock('@/components/atoms', () => ({
  DateDisplay: ({ date }: { date: string }) => <time>{date}</time>,
  TagList: ({ tags }: { tags: string[] }) => (
    <div>{tags.map(tag => <span key={tag}>{tag}</span>)}</div>
  ),
}));

function renderBlogCard(post: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={['/blog?from=list']}>
      <BlogCard post={post as any} />
    </MemoryRouter>,
  );
}

describe('BlogCard', () => {
  it('normalizes rendered metadata and suppresses unsafe cover images', () => {
    renderBlogCard({
      title: ' Title\u0000\nOne ',
      description: ' Description\u0000\ntext ',
      category: ' AI\u0000\nSearch ',
      author: ' Author\u0000\nName ',
      year: '2026',
      slug: 'unsafe/slug',
      date: '2026-07-03',
      coverImage: 'javascript:alert(1)',
      readingTime: ' 4\u0000 min read ',
      tags: [' tag\u0000\none ', '\u0000'],
    });

    expect(screen.getByText('Title One')).toBeInTheDocument();
    expect(screen.getByText('Description text')).toBeInTheDocument();
    expect(screen.getByText('AI Search')).toBeInTheDocument();
    expect(screen.getByText('Author Name')).toBeInTheDocument();
    expect(screen.getByText('4 min read')).toBeInTheDocument();
    expect(screen.getByText('tag one')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Title One' })).not.toBeInTheDocument();

    const titleLink = screen.getByRole('link', { name: 'Title One' });
    expect(titleLink).toHaveAttribute('href', '/blog?from=list');
  });

  it('falls back when post path segments contain encoded separators or controls', () => {
    renderBlogCard({
      title: 'Unsafe encoded path',
      description: 'Description',
      category: 'General',
      year: '2026',
      slug: 'unsafe%2Fslug',
      date: '2026-07-03',
      tags: [],
    });

    expect(screen.getByRole('link', { name: 'Unsafe encoded path' })).toHaveAttribute(
      'href',
      '/blog?from=list',
    );
  });

  it('uses encoded safe post paths and safe image URLs', () => {
    renderBlogCard({
      title: 'Safe title',
      description: 'Safe description',
      category: 'General',
      author: 'Author',
      year: '2026',
      slug: 'safe slug',
      date: '2026-07-03',
      coverImage: ' https://example.com/cover.png ',
      tags: [],
    });

    expect(screen.getByRole('img', { name: 'Safe title' })).toHaveAttribute(
      'src',
      'https://example.com/cover.png',
    );
    expect(screen.getByRole('link', { name: 'Safe title' })).toHaveAttribute(
      'href',
      '/blog/2026/safe%20slug?from=list',
    );
  });
});
