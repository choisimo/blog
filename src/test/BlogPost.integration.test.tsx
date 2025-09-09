import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import BlogPost from '@/pages/BlogPost';

// Mock data layer
vi.mock('@/data/posts', () => {
  return {
    getPostBySlug: vi.fn(async () => ({
      id: 'test',
      title: 'Test Blog Post',
      description: 'Desc',
      excerpt: 'Desc',
      content: '# Hello\n\nWorld',
      date: '2025-01-01',
      author: 'Me',
      tags: ['tag1'],
      category: 'Tech',
      readingTime: '1 min read',
      slug: 'test',
      year: '2025',
      published: true,
    })),
    getPostsPage: vi.fn(async () => ({
      items: [
        {
          id: 'rel-1',
          title: 'Related One',
          description: 'Rel1',
          excerpt: 'Rel1',
          content: '',
          date: '2025-01-02',
          author: 'Me',
          tags: ['tag1'],
          category: 'Tech',
          readingTime: '2 min read',
          slug: 'rel-one',
          year: '2025',
          published: true,
        },
        {
          id: 'rel-2',
          title: 'Related Two',
          description: 'Rel2',
          excerpt: 'Rel2',
          content: '',
          date: '2025-01-03',
          author: 'Me',
          tags: ['tag2'],
          category: 'Tech',
          readingTime: '3 min read',
          slug: 'rel-two',
          year: '2025',
          published: true,
        },
      ],
      page: 1,
      pageSize: 6,
      total: 2,
      totalPages: 1,
      hasMore: false,
    })),
    prefetchPost: vi.fn(() => Promise.resolve()),
  };
});

// Mock MarkdownRenderer to force Suspense fallback first, then resolve
vi.mock('@/components/features/blog/MarkdownRenderer', () => {
  let resolved = false;
  let doResolve: () => void;
  const p = new Promise<void>(r => {
    doResolve = () => {
      resolved = true;
      r();
    };
  });
  const Comp = () => {
    if (!resolved) {
      throw p; // trigger Suspense fallback
    }
    return <div data-testid='markdown'>Rendered Markdown</div>;
  };
  // expose a handle so tests can resolve when needed
  return { default: Comp, __resolve: () => doResolve!() } as any;
});

// Import mocked modules (vi.mock hoists above)
import { prefetchPost } from '@/data/posts';
// @ts-expect-error - __resolve is a test-only export from the mock
import { __resolve as resolveMarkdown } from '@/components/features/blog/MarkdownRenderer';

const renderWithProviders = (initialEntries: string[]) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider>
        <Routes>
          <Route path='/blog/:year/:slug' element={<BlogPost />} />
          <Route path='*' element={<div>Fallback</div>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
};

describe('BlogPost integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Suspense fallback while MarkdownRenderer is loading, then renders content', async () => {
    renderWithProviders(['/blog/2025/test']);

    // Wait for page to leave initial loading state (title visible)
    await screen.findByText('Test Blog Post');

    // Suspense fallback should be visible initially
    const fallback = screen.getByLabelText(/Loading article content/i);
    expect(fallback).toBeInTheDocument();

    // Now resolve the mocked MarkdownRenderer and wait for fallback to disappear
    resolveMarkdown();
    await waitForElementToBeRemoved(() =>
      screen.queryByLabelText(/Loading article content/i)
    );

    // Content rendered
    expect(screen.getByTestId('markdown')).toBeInTheDocument();
  });

  it('prefetches related post markdown on hover and focus', async () => {
    const user = userEvent.setup();
    renderWithProviders(['/blog/2025/test']);

    // Resolve markdown so the page is stable
    resolveMarkdown();
    await screen.findByTestId('markdown');

    // Related links should appear
    const rel1 = await screen.findByRole('link', { name: /related one/i });
    const rel2 = await screen.findByRole('link', { name: /related two/i });

    await user.hover(rel1);
    expect(vi.mocked(prefetchPost)).toHaveBeenCalledWith('2025', 'rel-one');
    await user.unhover(rel1);

    rel2.focus();
    expect(vi.mocked(prefetchPost)).toHaveBeenCalledWith('2025', 'rel-two');
  });
});
