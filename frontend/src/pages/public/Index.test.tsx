import type { BlogPost } from '@/types/blog';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Index from './Index';

const indexMocks = vi.hoisted(() => ({
  searchResults: [] as BlogPost[],
  getPostsPage: vi.fn(),
  getTags: vi.fn(),
  getPosts: vi.fn(),
  getPostBySlug: vi.fn(),
  getPostCategoryCounts: vi.fn(),
  getEditorPicks: vi.fn(),
  getSiteContentBlock: vi.fn(),
}));

vi.mock('@/hooks/seo/useSEO', () => ({
  useSEO: vi.fn(),
}));

vi.mock('@/utils/seo/seo', () => ({
  generateSEOData: vi.fn(() => ({})),
  generateStructuredData: vi.fn(() => ({})),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('@/data/content/posts', () => ({
  getTags: indexMocks.getTags,
  getPosts: indexMocks.getPosts,
  getPostsPage: indexMocks.getPostsPage,
  getPostBySlug: indexMocks.getPostBySlug,
  getPostCategoryCounts: indexMocks.getPostCategoryCounts,
}));

vi.mock('@/services/content/analytics', () => ({
  getEditorPicks: indexMocks.getEditorPicks,
}));

vi.mock('@/services/content/site-content', () => ({
  HOME_AI_CTA_BLOCK_KEY: 'home-ai-cta',
  getSiteContentBlock: indexMocks.getSiteContentBlock,
}));

vi.mock('@/components/features/search/SearchBar', () => ({
  SearchBar: ({
    onSearchResults,
  }: {
    onSearchResults: (results: BlogPost[]) => void;
  }) => (
    <button
      type='button'
      onClick={() => onSearchResults(indexMocks.searchResults)}
    >
      emit search results
    </button>
  ),
}));

vi.mock('@/components/features/home', () => ({
  HomeCategoryStrip: () => <div data-testid='home-category-strip' />,
  HomeEditorPicksSection: () => <div data-testid='home-editor-picks' />,
  HomeLatestPostsSection: () => <div data-testid='home-latest-posts' />,
  HomeMarkdownCta: () => <div data-testid='home-markdown-cta' />,
}));

vi.mock('@/components', () => ({
  PostCard: ({ post }: { post: BlogPost }) => (
    <article data-testid='post-card'>
      {post.year}/{post.slug} - {post.title} - {post.category}
    </article>
  ),
}));

function makePost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    year: '2026',
    slug: 'safe-post',
    title: 'Safe post',
    category: 'Engineering',
    excerpt: 'Safe excerpt',
    date: '2026-01-01',
    readingTime: '4 min read',
    tags: ['React'],
    ...overrides,
  } as BlogPost;
}

describe('Index search result boundary', () => {
  beforeEach(() => {
    indexMocks.searchResults = [];
    indexMocks.getPostsPage.mockResolvedValue({ items: [] });
    indexMocks.getTags.mockResolvedValue([]);
    indexMocks.getPosts.mockResolvedValue([]);
    indexMocks.getPostBySlug.mockResolvedValue(null);
    indexMocks.getPostCategoryCounts.mockResolvedValue({});
    indexMocks.getEditorPicks.mockResolvedValue({ degraded: false, data: [] });
    indexMocks.getSiteContentBlock.mockResolvedValue(null);
  });

  it('filters unsafe search result paths and sanitizes visible post metadata', () => {
    indexMocks.searchResults = [
      makePost({
        year: '2026%2Fadmin',
        slug: 'hidden-post',
        title: 'Hidden post',
      }),
      makePost({
        year: '2026',
        slug: 'safe-post',
        title: '\u001b[31mSafe post\u001b[0m\u0007',
        category: 'Engineer\u0000ing',
      }),
    ];

    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'emit search results' }));

    expect(screen.getByText('1 match')).toBeInTheDocument();
    expect(screen.getByTestId('post-card')).toHaveTextContent(
      '2026/safe-post - Safe post - Engineering'
    );
    expect(screen.queryByText(/Hidden post/)).not.toBeInTheDocument();
  });
});
