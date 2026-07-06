import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import SeriesNavigation from '@/components/features/blog/SeriesNavigation';

const prefetchPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/data/content/posts', () => ({
  prefetchPost: prefetchPostMock,
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

function renderSeriesNavigation(props: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={['/blog?from=list']}>
      <SeriesNavigation {...props as any} />
    </MemoryRouter>,
  );
}

describe('SeriesNavigation', () => {
  it('normalizes series titles and filters unsafe post path segments', () => {
    renderSeriesNavigation({
      currentPost: {
        year: '2026',
        slug: 'current',
        title: 'Current',
        series: 'deep\u0000-dive',
      },
      seriesPosts: [
        {
          year: '2026',
          slug: 'previous',
          title: ' Previous\u0000\nPost ',
          seriesOrder: 1,
          date: '2026-01-01',
        },
        {
          year: '2026',
          slug: 'current',
          title: ' Current\u0000\nPost ',
          seriesOrder: 2,
          date: '2026-01-02',
        },
        {
          year: '2026',
          slug: 'unsafe/slug',
          title: 'Unsafe',
          seriesOrder: 3,
          date: '2026-01-03',
        },
        {
          year: '2026',
          slug: 'unsafe%09slug',
          title: 'Unsafe Encoded',
          seriesOrder: 4,
          date: '2026-01-04',
        },
      ],
    });

    expect(screen.getByText('Series: Deep Dive')).toBeInTheDocument();
    expect(screen.getByText('Previous Post')).toBeInTheDocument();
    expect(screen.getByText('Current Post')).toBeInTheDocument();
    expect(screen.queryByText('Unsafe')).not.toBeInTheDocument();
    expect(screen.queryByText('Unsafe Encoded')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Previous Post/i })).toHaveAttribute(
      'href',
      '/blog/2026/previous?from=list',
    );
  });

  it('encodes safe slug segments and prefetches normalized post ids', () => {
    renderSeriesNavigation({
      currentPost: {
        year: '2026',
        slug: 'safe slug',
        title: 'Current',
        series: 'series',
      },
      seriesPosts: [
        {
          year: '2026',
          slug: 'safe slug',
          title: 'Current',
          seriesOrder: 1,
          date: 'invalid-date',
        },
        {
          year: '2026',
          slug: 'next post',
          title: 'Next',
          seriesOrder: 2,
          date: '2026-01-02',
        },
      ],
    });

    const nextLink = screen.getByRole('link', { name: /Next/i });
    expect(nextLink).toHaveAttribute('href', '/blog/2026/next%20post?from=list');

    fireEvent.mouseEnter(nextLink);
    expect(prefetchPostMock).toHaveBeenCalledWith('2026', 'next%20post');
  });

  it('drops unsafe preserved search strings before building links', () => {
    render(
      <MemoryRouter initialEntries={['/blog?next=%09tab']}>
        <SeriesNavigation
          currentPost={{
            year: '2026',
            slug: 'current',
            title: 'Current',
            series: 'series',
          } as any}
          seriesPosts={[
            {
              year: '2026',
              slug: 'current',
              title: 'Current',
              seriesOrder: 1,
              date: '2026-01-01',
            },
            {
              year: '2026',
              slug: 'next',
              title: 'Next',
              seriesOrder: 2,
              date: '2026-01-02',
            },
          ] as any}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Next/i })).toHaveAttribute(
      'href',
      '/blog/2026/next',
    );
  });
});
