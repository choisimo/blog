import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import PostCard from '@/components/features/blog/PostCard';

const prefetchPostMock = vi.hoisted(() => vi.fn());
const useIsBookmarkedMock = vi.hoisted(() => vi.fn(() => ({
  bookmarked: false,
  toggleBookmark: vi.fn(),
})));

vi.mock('@/data/content/posts', () => ({
  prefetchPost: prefetchPostMock,
}));

vi.mock('@/hooks/content/useBookmarks', () => ({
  useIsBookmarked: useIsBookmarkedMock,
}));

vi.mock('@/hooks/gesture/useTilt', () => ({
  useTilt: () => ({ current: null }),
}));

vi.mock('@/hooks/gesture/useSwipe', () => ({
  useSwipe: () => ({ ref: { current: null }, deltaX: 0, swiping: null }),
}));

vi.mock('@/hooks/i18n/useLanguage', () => ({
  default: () => ({ language: 'en' }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
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

function renderPostCard(post: Record<string, unknown>, variant: 'grid' | 'list' | 'mini' | 'featured' = 'grid') {
  return render(
    <MemoryRouter initialEntries={['/blog?from=list']}>
      <PostCard post={post as any} variant={variant} showTilt={false} />
    </MemoryRouter>,
  );
}

describe('PostCard', () => {
  it('normalizes grid metadata and suppresses unsafe image and post path values', () => {
    renderPostCard({
      title: ' Title\u0000\nOne ',
      description: ' Description\u0000\ntext ',
      category: ' AI\u0000\nSearch ',
      year: '2026',
      slug: 'unsafe/slug',
      date: '2026-07-03',
      coverImage: 'javascript:alert(1)',
      readingTime: ' 4\u0000 min read ',
      tags: [' tag\u0000\none ', '\u0000', 'tag-two', 'tag-three', 'tag-four'],
    });

    expect(useIsBookmarkedMock).toHaveBeenCalledWith('');
    expect(screen.getByText('Title One')).toBeInTheDocument();
    expect(screen.getByText('Description text')).toBeInTheDocument();
    expect(screen.getByText('AI Search')).toBeInTheDocument();
    expect(screen.getByText('4 min')).toBeInTheDocument();
    expect(screen.getByText('#tag one')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Title One' })).not.toBeInTheDocument();

    const titleLink = screen.getByRole('link', { name: 'Title One' });
    expect(titleLink).toHaveAttribute('href', '/blog?from=list');
  });

  it('uses encoded safe paths and safe image URLs in mini cards', () => {
    const { container } = renderPostCard({
      title: 'Safe title',
      description: 'Safe description',
      category: 'General',
      year: '2026',
      slug: 'safe slug',
      date: '2026-07-03',
      coverImage: ' https://example.com/cover.png ',
      tags: [],
    }, 'mini');

    expect(useIsBookmarkedMock).toHaveBeenCalledWith('2026/safe%20slug');
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/cover.png');
    expect(screen.getByRole('link', { name: /Safe title/i })).toHaveAttribute(
      'href',
      '/blog/2026/safe%20slug?from=list',
    );
  });

  it('falls back when path segments contain encoded separators or controls', () => {
    renderPostCard({
      title: 'Unsafe encoded path',
      description: 'Description',
      category: 'General',
      year: '2026',
      slug: 'unsafe%2Fslug',
      date: '2026-07-03',
      tags: [],
    });

    expect(useIsBookmarkedMock).toHaveBeenCalledWith('');
    expect(screen.getByRole('link', { name: 'Unsafe encoded path' })).toHaveAttribute(
      'href',
      '/blog?from=list',
    );
  });
});
