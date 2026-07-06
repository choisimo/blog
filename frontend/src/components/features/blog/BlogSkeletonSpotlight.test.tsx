import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BlogSkeletonSpotlight from './BlogSkeletonSpotlight';

describe('BlogSkeletonSpotlight', () => {
  it('exposes a sanitized spotlight loading status label and title', () => {
    render(
      <BlogSkeletonSpotlight
        label={'\u001b[31mLoading spotlight\u0000'}
        title={'\u001b[32mSpotlight placeholder\u0007'}
      />,
    );

    const status = screen.getByRole('status', { name: 'Loading spotlight' });

    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveAttribute('title', 'Spotlight placeholder');
    expect(status.outerHTML).not.toContain('\u001b');
    expect(status.outerHTML).not.toContain('\u0000');
    expect(status.outerHTML).not.toContain('\u0007');
  });

  it('keeps all spotlight skeleton blocks hidden from the accessibility tree', () => {
    const { container } = render(<BlogSkeletonSpotlight />);

    expect(screen.getByRole('status', { name: 'Loading spotlight blog post' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(7);
  });
});
