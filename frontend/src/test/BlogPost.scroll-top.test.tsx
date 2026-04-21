import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { render, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import BlogPost from '@/pages/public/BlogPost';

vi.mock('@/data/content/posts', () => {
  const post = {
    id: 'test',
    title: 'Test Blog Post',
    description: 'Desc',
      excerpt: 'Desc',
      content: '# Hello',
      date: '2025-01-01',
      author: 'Me',
      tags: ['tag1'],
      category: 'Tech',
      readingTime: '1 min read',
      slug: 'test',
      year: '2025',
      language: 'ko' as const,
      published: true,
  };
  return {
    getPostBySlug: vi.fn(async (_year: string, slug: string) => ({
      ...post,
      slug,
    })),
    getPostsPage: vi.fn(async () => ({
      items: [],
      page: 1,
      pageSize: 6,
      total: 0,
      totalPages: 0,
      hasMore: false,
    })),
    prefetchPost: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('@/components/features/blog/MarkdownRenderer', () => ({
  default: () => <div data-testid='markdown'>Rendered Markdown</div>,
}));

const renderRoute = (initialEntries: string[]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider>
        <LanguageProvider>
          <Routes>
            <Route path='/blog/:year/:slug' element={<BlogPost />} />
          </Routes>
        </LanguageProvider>
      </ThemeProvider>
    </MemoryRouter>
  );

describe('BlogPost scroll-to-top', () => {
  const origScrollTo = window.scrollTo;

  beforeEach(() => {
    // jsdom doesn't implement scrollTo; mock and track calls
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  it('scrolls to top when navigating to a different post', async () => {
    const firstView = renderRoute(['/blog/2025/foo']);
    // Wait for initial post title
    await within(firstView.container).findByRole('heading', {
      name: /Test Blog Post/i,
    });

    // Navigate to new entry by pushing a new location
    const secondView = renderRoute(['/blog/2025/bar']);
    await within(secondView.container).findByRole('heading', {
      name: /Test Blog Post/i,
    });

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  });

  it('records visited posts to localStorage on load', async () => {
    localStorage.clear();
    const view = renderRoute(['/blog/2025/abc']);
    await within(view.container).findByRole('heading', {
      name: /Test Blog Post/i,
    });
    const raw = localStorage.getItem('visited.posts');
    expect(raw).toBeTruthy();
    const arr = JSON.parse(raw || '[]');
    expect(arr[0].path).toBe('/blog/2025/abc');
  });

  // restore scrollTo for any other tests
  afterAll(() => {
    window.scrollTo = origScrollTo;
  });
});
