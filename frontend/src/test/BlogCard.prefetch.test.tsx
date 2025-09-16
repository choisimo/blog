import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from '../contexts/ThemeContext';
import { BrowserRouter } from 'react-router-dom';
import { BlogCard } from '../components/features/blog';

vi.mock('@/data/posts', () => {
  return {
    prefetchPost: vi.fn(() => Promise.resolve()),
  };
});

// Use ESM import so alias resolution works under Vitest
import { prefetchPost } from '@/data/posts';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider>{ui}</ThemeProvider>
    </BrowserRouter>
  );
};

const mockPost = {
  id: '1',
  title: 'Test Blog Post',
  description: 'Description',
  excerpt: 'Description',
  date: '2025-01-01',
  year: '2025',
  category: 'Tech',
  tags: ['React'],
  content: '',
  slug: 'test-blog-post',
  readTime: 5,
  readingTime: '5 min read',
  author: 'Me',
  published: true,
};

describe('BlogCard prefetch triggers', () => {
  beforeEach(() => {
    vi.mocked(prefetchPost).mockClear();
  });

  it('calls prefetchPost on hover and focus for title link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BlogCard post={mockPost} />);

    const titleLink = screen.getByRole('link', { name: /test blog post/i });

    await user.hover(titleLink);
    expect(vi.mocked(prefetchPost)).toHaveBeenCalledWith(
      '2025',
      'test-blog-post'
    );

    await user.unhover(titleLink);

    await user.tab(); // focus first focusable element (likely the link)
    expect(vi.mocked(prefetchPost)).toHaveBeenCalledWith(
      '2025',
      'test-blog-post'
    );
  });

  it('calls prefetchPost on hover and focus for Read more link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BlogCard post={mockPost} />);

    const readMore = screen.getByRole('link', { name: /read more/i });

    await user.hover(readMore);
    expect(vi.mocked(prefetchPost)).toHaveBeenCalledWith(
      '2025',
      'test-blog-post'
    );

    await user.unhover(readMore);

    readMore.focus();
    expect(vi.mocked(prefetchPost)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(prefetchPost)).toHaveBeenNthCalledWith(
      1,
      '2025',
      'test-blog-post'
    );
    expect(vi.mocked(prefetchPost)).toHaveBeenNthCalledWith(
      2,
      '2025',
      'test-blog-post'
    );
  });
});
