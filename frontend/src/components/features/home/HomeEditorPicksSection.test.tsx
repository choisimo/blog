import type { ImgHTMLAttributes } from 'react';
import type { BlogPost } from '@/types/blog';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HomeEditorPicksSection } from './HomeEditorPicksSection';

vi.mock('@/components/common/OptimizedImage', () => ({
  OptimizedImage: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} />
  ),
}));

function makePost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    year: '2026',
    slug: 'safe-post',
    title: 'Safe post',
    date: '2026-01-15',
    category: 'Engineering',
    readingTime: '4 min read',
    coverImage: '/safe.jpg',
    ...overrides,
  } as BlogPost;
}

function renderSection(posts: BlogPost[], notice: string | null = null) {
  render(
    <MemoryRouter>
      <HomeEditorPicksSection
        posts={posts}
        state='ready'
        notice={notice}
        isTerminal={false}
      />
    </MemoryRouter>
  );
}

describe('HomeEditorPicksSection', () => {
  it('filters unsafe blog path segments and sanitizes rendered metadata', () => {
    renderSection(
      [
        makePost({
          year: '2026%2Fadmin',
          slug: 'hidden-post',
          title: 'Hidden post',
        }),
        makePost({
          year: '2026',
          slug: 'safe-post',
          title: '\u001b[31mSafe\u001b[0m post\u0007',
          category: 'Engineer\u0000ing',
          readingTime: '\u001b[32m4 min read\u001b[0m',
        }),
      ],
      '\u001b[33mCurated now\u001b[0m'
    );

    expect(screen.queryByText('Hidden post')).not.toBeInTheDocument();
    expect(screen.getByText('Curated now')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('4 min read')).toBeInTheDocument();
    expect(screen.getByAltText('Safe post')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Safe post/i })).toHaveAttribute(
      'href',
      '/blog/2026/safe-post'
    );
  });

  it('falls back to the empty state when all editor picks have unsafe paths', () => {
    renderSection([
      makePost({ year: '2026', slug: '..', title: 'Traversal post' }),
      makePost({ year: '2026', slug: 'bad%5Cslug', title: 'Encoded post' }),
    ]);

    expect(screen.queryByText('Traversal post')).not.toBeInTheDocument();
    expect(screen.queryByText('Encoded post')).not.toBeInTheDocument();
    expect(screen.getByText('추천 포스트를 준비 중입니다.')).toBeInTheDocument();
  });
});
