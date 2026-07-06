import type { BlogPost } from '@/types/blog';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prefetchPost } from '@/data/content/posts';
import SeriesNavigation from './SeriesNavigation';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('@/data/content/posts', () => ({
  prefetchPost: vi.fn(),
}));

function post(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    title: 'Post',
    year: '2026',
    slug: 'post',
    series: 'safe-series',
    seriesOrder: 1,
    date: '2026-07-05',
    ...overrides,
  } as BlogPost;
}

function renderSeries(ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={['/blog/2026/current?tag=AI']}>{ui}</MemoryRouter>);
}

describe('SeriesNavigation', () => {
  beforeEach(() => {
    vi.mocked(prefetchPost).mockReset();
  });

  it('sanitizes section labels, series title, post titles, and link labels', () => {
    const { container } = renderSeries(
      <SeriesNavigation
        currentPost={post({
          title: 'Current',
          slug: 'current',
          series: '\u001b[31msafe-series\u0000',
          seriesOrder: 2,
        })}
        seriesPosts={[
          post({ title: '\u001b[32mPrevious\u0000', slug: 'previous', seriesOrder: 1 }),
          post({ title: '\u001b[33mCurrent\u0007', slug: 'current', seriesOrder: 2 }),
          post({ title: '\u001b[34mNext\u0000', slug: 'next', seriesOrder: 3 }),
        ]}
        label={'\u001b[35mSeries nav\u0000'}
        title={'\u001b[36mSeries title\u0007'}
        previousLabel={'\u001b[31mPrev\u0000'}
        nextLabel={'\u001b[32mNext item\u0000'}
        itemLabel={'\u001b[33mPart\u0000'}
      />
    );

    expect(screen.getByRole('region', { name: 'Series nav' })).toHaveAttribute(
      'title',
      'Series title'
    );
    expect(screen.getByText('Series: Safe Series')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Part 2: Current' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Prev: Previous' })).toHaveAttribute(
      'href',
      '/blog/2026/previous?tag=AI'
    );
    expect(screen.getByRole('link', { name: 'Next item: Next' })).toHaveAttribute(
      'href',
      '/blog/2026/next?tag=AI'
    );
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('filters unsafe series posts and prefetches safe target segments', () => {
    renderSeries(
      <SeriesNavigation
        currentPost={post({ title: 'Current', slug: 'current', seriesOrder: 1 })}
        seriesPosts={[
          post({ title: 'Current', slug: 'current', seriesOrder: 1 }),
          post({ title: 'Unsafe', slug: 'bad%2Fslug', seriesOrder: 2 }),
          post({ title: 'Next', slug: 'next', seriesOrder: 3 }),
        ]}
      />
    );

    expect(screen.queryByText('Unsafe')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Next series post: Next' }));

    expect(prefetchPost).toHaveBeenCalledWith('2026', 'next');
  });

  it('renders nothing when fewer than two safe series posts remain', () => {
    const { container } = renderSeries(
      <SeriesNavigation
        currentPost={post({ slug: 'current' })}
        seriesPosts={[
          post({ title: 'Current', slug: 'current' }),
          post({ title: 'Unsafe', slug: 'bad%2Fslug' }),
        ]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
