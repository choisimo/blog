import type { BlogPost } from '@/types/blog';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PostNavigation } from './PostNavigation';

function post(year: string, slug: string, title: string): BlogPost {
  return { year, slug, title } as BlogPost;
}

function renderPostNavigation(ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={['/blog/2026/current?category=AI']}>{ui}</MemoryRouter>);
}

describe('PostNavigation', () => {
  it('sanitizes navigation labels and adjacent post titles while preserving safe links', () => {
    const { container } = renderPostNavigation(
      <PostNavigation
        currentPost={post('2026', 'current', 'Current')}
        label={'\u001b[35mAdjacent posts\u0000'}
        title={'\u001b[34mMore reading\u0007'}
        previousLabel={'\u001b[31mOlder\u0000'}
        nextLabel={'\u001b[32mNewer\u0000'}
        posts={[
          post('2026', 'newer', '\u001b[36mNewer Title\u0000'),
          post('2026', 'current', 'Current'),
          post('2025', 'older', '\u001b[33mOlder Title\u0007'),
        ]}
      />
    );

    expect(screen.getByRole('navigation', { name: 'Adjacent posts' })).toHaveAttribute(
      'title',
      'More reading'
    );
    expect(screen.getByRole('link', { name: 'Older: Older Title' })).toHaveAttribute(
      'href',
      '/blog/2025/older?category=AI'
    );
    expect(screen.getByRole('link', { name: 'Newer: Newer Title' })).toHaveAttribute(
      'href',
      '/blog/2026/newer?category=AI'
    );
    expect(screen.getByText('Older Title')).toBeInTheDocument();
    expect(screen.getByText('Newer Title')).toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('filters unsafe adjacent posts and keeps encoded-safe path segments canonicalized', () => {
    renderPostNavigation(
      <PostNavigation
        currentPost={post('2026', 'current', 'Current')}
        posts={[
          post('2026', 'current', 'Current'),
          post('2026', 'bad/slash', 'Unsafe slash'),
          post('2026', 'spaced slug', 'Spaced title'),
        ]}
      />
    );

    expect(screen.queryByText('Unsafe slash')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Previous Post: Spaced title' })).toHaveAttribute(
      'href',
      '/blog/2026/spaced%20slug'
    );
  });

  it('drops unsafe preserved search and renders nothing without adjacent posts', () => {
    const { container, rerender } = renderPostNavigation(
      <PostNavigation
        currentPost={post('2026', 'current', 'Current')}
        fromState={{ search: '?category=%0Aunsafe' }}
        posts={[
          post('2026', 'current', 'Current'),
          post('2025', 'older', 'Older title'),
        ]}
      />
    );

    expect(screen.getByRole('link', { name: 'Previous Post: Older title' })).toHaveAttribute(
      'href',
      '/blog/2025/older'
    );

    rerender(
      <MemoryRouter>
        <PostNavigation
          currentPost={post('2026', 'current', 'Current')}
          posts={[post('2026', 'current', 'Current')]}
        />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
