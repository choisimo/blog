import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import PostNavigation from '@/components/features/navigation/PostNavigation';

function renderPostNavigation(props: Record<string, unknown>, initialPath = '/blog/current?from=list') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PostNavigation {...props as any} />
    </MemoryRouter>,
  );
}

describe('PostNavigation', () => {
  it('normalizes navigation titles and filters posts with unsafe path segments', () => {
    renderPostNavigation({
      currentPost: { year: '2026', slug: 'current', title: 'Current' },
      posts: [
        { year: '2026', slug: 'next post', title: ' Next\u0000\nPost ' },
        { year: '2026', slug: 'current', title: 'Current' },
        { year: '2026', slug: 'bad/previous', title: 'Bad Previous' },
        { year: '2026', slug: 'bad%09previous', title: 'Encoded Bad Previous' },
        { year: '2026', slug: 'previous', title: ' Previous\u0000\nPost ' },
      ],
    });

    expect(screen.getByText('Next Post')).toBeInTheDocument();
    expect(screen.queryByText('Bad Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Encoded Bad Previous')).not.toBeInTheDocument();
    expect(screen.getByText('Previous Post')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Next Post/i })).toHaveAttribute(
      'href',
      '/blog/2026/next%20post?from=list',
    );
    expect(screen.getByRole('link', { name: /Previous Post/i })).toHaveAttribute(
      'href',
      '/blog/2026/previous?from=list',
    );
  });

  it('drops unsafe preserved search strings before building links', () => {
    renderPostNavigation(
      {
        currentPost: { year: '2026', slug: 'current', title: 'Current' },
        posts: [
          { year: '2026', slug: 'next', title: 'Next' },
          { year: '2026', slug: 'current', title: 'Current' },
        ],
        fromState: { search: '?next=%09tab' },
      },
      '/blog/current?safe=1',
    );

    expect(screen.getByRole('link', { name: /Next/i })).toHaveAttribute(
      'href',
      '/blog/2026/next',
    );
  });
});
