import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import Breadcrumb from '@/components/features/navigation/Breadcrumb';

function renderBreadcrumb(items: Array<{ label: string; href?: string }>) {
  return render(
    <MemoryRouter>
      <Breadcrumb items={items} />
    </MemoryRouter>,
  );
}

describe('Breadcrumb', () => {
  it('normalizes labels and filters empty breadcrumb items before rendering', () => {
    renderBreadcrumb([
      { label: ' Blog\u0000\nPosts ', href: '/blog' },
      { label: '\u0000', href: '/ignored' },
      { label: ' Current\u0000\nPost ' },
    ]);

    expect(screen.getByRole('link', { name: 'Blog Posts' })).toHaveAttribute('href', '/blog');
    expect(screen.getByText('Current Post')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText(/\u0000/)).not.toBeInTheDocument();
    expect(screen.queryByText('ignored')).not.toBeInTheDocument();
  });

  it('unwraps unsafe breadcrumb hrefs while preserving labels', () => {
    renderBreadcrumb([
      { label: 'Unsafe', href: 'javascript:alert(1)' },
      { label: 'Protocol', href: '//evil.test/path' },
      { label: 'Encoded Control', href: '/blog/2026/post%00x' },
      { label: 'Encoded Separator', href: '/blog/2026/bad%2Fslug' },
      { label: 'Malformed Percent', href: '/blog/2026/%E0%A4%A' },
      { label: 'Safe', href: '/safe/path' },
      { label: 'Current' },
    ]);

    expect(screen.queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Protocol' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Encoded Control' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Encoded Separator' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Malformed Percent' })).not.toBeInTheDocument();
    expect(screen.getByText('Unsafe')).toBeInTheDocument();
    expect(screen.getByText('Protocol')).toBeInTheDocument();
    expect(screen.getByText('Encoded Control')).toBeInTheDocument();
    expect(screen.getByText('Encoded Separator')).toBeInTheDocument();
    expect(screen.getByText('Malformed Percent')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Safe' })).toHaveAttribute('href', '/safe/path');
  });
});
