import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BlogSkeletonFeatured from './BlogSkeletonFeatured';

describe('BlogSkeletonFeatured', () => {
  it('exposes a sanitized featured loading status label and title', () => {
    const { container } = render(
      <BlogSkeletonFeatured
        label={'\u001b[31mLoading featured\u0000'}
        title={'\u001b[32mFeatured placeholder\u0007'}
      />
    );

    expect(screen.getByRole('status', { name: 'Loading featured' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(screen.getByRole('status', { name: 'Loading featured' })).toHaveAttribute(
      'title',
      'Featured placeholder'
    );
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('keeps all featured skeleton blocks hidden from the accessibility tree', () => {
    const { container } = render(<BlogSkeletonFeatured />);

    expect(screen.getByRole('status', { name: 'Loading featured blog post' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(9);
  });
});
