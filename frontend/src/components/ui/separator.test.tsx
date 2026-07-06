import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-separator', async () => {
  const React = await import('react');

  type RootProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    decorative?: boolean;
    orientation?: 'horizontal' | 'vertical';
  };

  const Root = React.forwardRef<HTMLDivElement, RootProps>(
    ({ decorative, orientation, ...props }, ref) => (
      <div
        ref={ref}
        role={decorative ? 'presentation' : 'separator'}
        data-decorative={String(decorative)}
        data-orientation={orientation}
        data-testid='separator'
        {...props}
      />
    )
  );
  Root.displayName = 'Root';

  return {
    Root,
  };
});

import { Separator } from './separator';

describe('Separator accessibility text boundaries', () => {
  it('sanitizes accessibility labels while preserving orientation and decorative props', () => {
    render(
      <Separator
        decorative={false}
        orientation='vertical'
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mSidebar\u0000 divider'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mDivider\u0007'}
      />
    );

    const separator = screen.getByRole('separator', {
      name: 'Sidebar divider',
    });

    expect(separator).toHaveAttribute('title', 'Divider');
    expect(separator).not.toHaveAttribute('aria-label', expect.stringContaining('Hidden'));
    expect(separator).toHaveAttribute('data-decorative', 'false');
    expect(separator).toHaveAttribute('data-orientation', 'vertical');
    expect(separator.className).toContain('h-full');
    expect(separator.className).toContain('w-[1px]');
  });

  it('omits empty sanitized accessibility text and preserves decorative default', () => {
    render(
      <Separator
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      />
    );

    const separator = screen.getByTestId('separator');

    expect(separator).not.toHaveAttribute('aria-label');
    expect(separator).not.toHaveAttribute('title');
    expect(separator).toHaveAttribute('data-decorative', 'true');
    expect(separator).toHaveAttribute('data-orientation', 'horizontal');
  });
});
