import type { ReactNode } from 'react';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PopoverContent } from './popover';

vi.mock('@radix-ui/react-popover', () => {
  const Content = React.forwardRef<
    HTMLDivElement,
    Record<string, unknown> & { children?: ReactNode }
  >(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));

  return {
    Root: ({ children }: { children: ReactNode }) => <>{children}</>,
    Trigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
    Content,
  };
});

describe('PopoverContent', () => {
  it('sanitizes popover text and accessibility labels', () => {
    const { container } = render(
      <PopoverContent
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mFilter popover\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mPopover title\u001b[0m\u0007'}
      >
        {'\u001b]0;Hidden child\u0007\u001b[33mFilter options\u001b[0m\u0000'}
      </PopoverContent>
    );

    const popover = screen.getByLabelText('Filter popover');
    expect(popover).toHaveAttribute('title', 'Popover title');
    expect(popover).toHaveTextContent('Filter options');
    expect(container.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized labels and preserves element children', () => {
    const { container } = render(
      <PopoverContent
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      >
        {'\u001b]0;Hidden prefix\u0007\u001b[33mPrefix\u001b[0m\u0000'}
        <span>Trusted child</span>
      </PopoverContent>
    );

    const child = screen.getByText('Trusted child');
    const popover = child.closest('div');
    expect(screen.getByText('Prefix')).toBeInTheDocument();
    expect(popover).not.toHaveAttribute('aria-label');
    expect(popover).not.toHaveAttribute('title');
    expect(container.textContent).not.toContain('Hidden');
  });
});
