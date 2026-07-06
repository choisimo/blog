import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-checkbox', async () => {
  const React = await import('react');

  type RootProps = ReactTypes.ButtonHTMLAttributes<HTMLButtonElement> & {
    checked?: boolean | 'indeterminate';
  };

  const Root = React.forwardRef<HTMLButtonElement, RootProps>(
    ({ children, checked, ...props }, ref) => (
      <button
        ref={ref}
        role='checkbox'
        aria-checked={checked === 'indeterminate' ? 'mixed' : checked}
        data-checked={String(checked)}
        data-testid='checkbox'
        type='button'
        {...props}
      >
        {children}
      </button>
    )
  );
  Root.displayName = 'Root';

  const Indicator = ({
    children,
    ...props
  }: ReactTypes.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid='indicator' {...props}>
      {children}
    </span>
  );
  Indicator.displayName = 'Indicator';

  return {
    Root,
    Indicator,
  };
});

import { Checkbox } from './checkbox';

describe('Checkbox text boundaries', () => {
  it('sanitizes accessibility labels while preserving checkbox state', () => {
    render(
      <Checkbox
        checked='indeterminate'
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mAccept\u0000 terms'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mTerms\u0007 checkbox'}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Accept terms' });

    expect(checkbox).toHaveAttribute('title', 'Terms checkbox');
    expect(checkbox.getAttribute('aria-label')).not.toContain('Hidden');
    expect(checkbox.getAttribute('title')).not.toContain('Hidden');
    expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    expect(checkbox).toHaveAttribute('data-checked', 'indeterminate');
    expect(screen.getByTestId('indicator')).toBeInTheDocument();
  });

  it('omits empty sanitized accessibility text', () => {
    render(
      <Checkbox
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      />
    );

    const checkbox = screen.getByTestId('checkbox');

    expect(checkbox).not.toHaveAttribute('aria-label');
    expect(checkbox).not.toHaveAttribute('title');
  });
});
