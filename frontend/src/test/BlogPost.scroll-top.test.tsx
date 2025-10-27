import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import BlogPost from '@/pages/BlogPost';

vi.mock('@/data/posts', () => {
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
        <Routes>
          <Route path='/blog/:year/:slug' element={<BlogPost />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );

describe('BlogPost scroll-to-top', () => {
  const origScrollTo = window.scrollTo;

  beforeEach(() => {
    // jsdom doesn't implement scrollTo; mock and track calls
    // @ts-expect-error - allow spying on scrollTo
    window.scrollTo = vi.fn();
  });

  it('scrolls to top when navigating to a different post', async () => {
    renderRoute(['/blog/2025/foo']);
    // Wait for initial post title
    await screen.findByText(/Test Blog Post/i);

    // Navigate to new entry by pushing a new location
    renderRoute(['/blog/2025/bar']);
    await screen.findByText(/Test Blog Post/i);

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  });

  it('records visited posts to localStorage on load', async () => {
    localStorage.clear();
    renderRoute(['/blog/2025/abc']);
    await screen.findByText(/Test Blog Post/i);
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
