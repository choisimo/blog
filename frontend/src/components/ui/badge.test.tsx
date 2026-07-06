import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('sanitizes string children and accessibility labels', () => {
    render(
      <Badge
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31mStatus badge\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mBadge title\u001b[0m\u0007'}
      >
        {'\u001b]0;Hidden child\u0007\u001b[33mActive\u001b[0m\u0000'}
      </Badge>
    );

    const badge = screen.getByLabelText('Status badge');
    expect(badge).toHaveTextContent('Active');
    expect(badge).toHaveAttribute('title', 'Badge title');
    expect(badge.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized label attributes and preserves element children', () => {
    render(
      <Badge
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      >
        {'\u001b]0;Hidden prefix\u0007\u001b[33mPrefix\u001b[0m\u0000'}
        <span>Trusted child</span>
      </Badge>
    );

    const child = screen.getByText('Trusted child');
    const badge = child.closest('div');
    expect(screen.getByText('Prefix')).toBeInTheDocument();
    expect(badge).not.toHaveAttribute('aria-label');
    expect(badge).not.toHaveAttribute('title');
  });
});
