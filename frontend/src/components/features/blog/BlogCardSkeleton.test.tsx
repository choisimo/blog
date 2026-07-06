import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BlogCardSkeleton from './BlogCardSkeleton';

describe('BlogCardSkeleton', () => {
  it('exposes a sanitized loading status label and title', () => {
    const { container } = render(
      <BlogCardSkeleton
        label={'\u001b[31mLoading posts\u0000'}
        title={'\u001b[32mBlog placeholder\u0007'}
      />
    );

    expect(screen.getByRole('status', { name: 'Loading posts' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(screen.getByRole('status', { name: 'Loading posts' })).toHaveAttribute(
      'title',
      'Blog placeholder'
    );
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('keeps all skeleton blocks hidden from the accessibility tree', () => {
    const { container } = render(<BlogCardSkeleton />);

    expect(screen.getByRole('status', { name: 'Loading blog post' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(14);
  });
});
