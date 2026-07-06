import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BlogSkeletonList from './BlogSkeletonList';

describe('BlogSkeletonList', () => {
  it('exposes a sanitized list loading status label and title', () => {
    render(
      <BlogSkeletonList
        label={'\u001b[31mLoading list\u0000'}
        title={'\u001b[32mList placeholder\u0007'}
      />,
    );

    const status = screen.getByRole('status', { name: 'Loading list' });

    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('title', 'List placeholder');
    expect(status.outerHTML).not.toContain('\u001b');
    expect(status.outerHTML).not.toContain('\u0000');
    expect(status.outerHTML).not.toContain('\u0007');
  });

  it('keeps all list skeleton blocks hidden from the accessibility tree', () => {
    const { container } = render(<BlogSkeletonList />);

    expect(screen.getByRole('status', { name: 'Loading blog post preview' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(9);
  });
});
