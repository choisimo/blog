import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Breadcrumb } from './Breadcrumb';

function renderBreadcrumb(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Breadcrumb', () => {
  it('sanitizes navigation labels, home label, title, and item text', () => {
    const { container } = renderBreadcrumb(
      <Breadcrumb
        label={'\u001b[35mTrail\u0000'}
        title={'\u001b[34mTrail title\u0007'}
        homeLabel={'\u001b[32mStart\u0000'}
        items={[
          { label: '\u001b[31mPosts\u0000', href: '/blog' },
          { label: '\u001b[36mCurrent\u0007', href: '/blog/current' },
        ]}
      />
    );

    expect(screen.getByRole('navigation', { name: 'Trail' })).toHaveAttribute(
      'title',
      'Trail title'
    );
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Posts' })).toHaveAttribute('href', '/blog');
    expect(screen.getByText('Current')).toHaveAttribute('aria-current', 'page');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('keeps safe internal links and renders unsafe breadcrumb hrefs as text', () => {
    renderBreadcrumb(
      <Breadcrumb
        items={[
          { label: 'Encoded slash', href: '/blog/2026/hidden%2Fpost' },
          { label: 'Protocol path', href: '//example.test/post' },
          { label: 'Safe post', href: '/blog/2026/safe-post' },
          { label: 'Current post', href: '/blog/2026/current-post' },
        ]}
      />
    );

    expect(screen.getByText('Encoded slash')).not.toHaveAttribute('href');
    expect(screen.getByText('Protocol path')).not.toHaveAttribute('href');
    expect(screen.getByRole('link', { name: 'Safe post' })).toHaveAttribute(
      'href',
      '/blog/2026/safe-post'
    );
    expect(screen.getByText('Current post')).toHaveAttribute('aria-current', 'page');
  });

  it('filters empty labels and falls back to default accessibility labels', () => {
    renderBreadcrumb(
      <Breadcrumb
        label={'\u0000'}
        homeLabel={'\u0007'}
        items={[
          { label: '\u0000', href: '/hidden' },
          { label: 'Visible', href: '/visible' },
        ]}
      />
    );

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
    expect(screen.getByText('Visible')).toHaveAttribute('aria-current', 'page');
  });
});
