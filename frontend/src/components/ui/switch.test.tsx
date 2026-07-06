import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-switch', async () => {
  const React = await import('react');

  type RootProps = ReactTypes.ButtonHTMLAttributes<HTMLButtonElement> & {
    checked?: boolean;
  };

  const Root = React.forwardRef<HTMLButtonElement, RootProps>(
    ({ children, checked, ...props }, ref) => (
      <button
        ref={ref}
        role='switch'
        aria-checked={checked}
        data-checked={String(checked)}
        data-testid='switch'
        type='button'
        {...props}
      >
        {children}
      </button>
    )
  );
  Root.displayName = 'Root';

  const Thumb = (props: ReactTypes.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid='thumb' {...props} />
  );
  Thumb.displayName = 'Thumb';

  return {
    Root,
    Thumb,
  };
});

import { Switch } from './switch';

describe('Switch text boundaries', () => {
  it('sanitizes accessibility labels while preserving switch state', () => {
    render(
      <Switch
        checked
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mEnable\u0000 notifications'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mNotifications\u0007 switch'}
      />
    );

    const control = screen.getByRole('switch', {
      name: 'Enable notifications',
    });

    expect(control).toHaveAttribute('title', 'Notifications switch');
    expect(control.getAttribute('aria-label')).not.toContain('Hidden');
    expect(control.getAttribute('title')).not.toContain('Hidden');
    expect(control).toHaveAttribute('aria-checked', 'true');
    expect(control).toHaveAttribute('data-checked', 'true');
    expect(screen.getByTestId('thumb')).toBeInTheDocument();
  });

  it('omits empty sanitized accessibility text', () => {
    render(
      <Switch
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      />
    );

    const control = screen.getByTestId('switch');

    expect(control).not.toHaveAttribute('aria-label');
    expect(control).not.toHaveAttribute('title');
  });
});
