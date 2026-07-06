import type { ReactNode } from 'react';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipContent } from './tooltip';

vi.mock('@radix-ui/react-tooltip', () => {
  const Content = React.forwardRef<
    HTMLDivElement,
    Record<string, unknown> & { children?: ReactNode }
  >(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));

  return {
    Provider: ({ children }: { children: ReactNode }) => <>{children}</>,
    Root: ({ children }: { children: ReactNode }) => <>{children}</>,
    Trigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    Content,
  };
});

describe('TooltipContent', () => {
  it('sanitizes tooltip text and accessibility labels', () => {
    const { container } = render(
      <TooltipContent
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mHelp tooltip\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mTooltip title\u001b[0m\u0007'}
      >
        {'\u001b]0;Hidden child\u0007\u001b[33mHelpful context\u001b[0m\u0000'}
      </TooltipContent>
    );

    const tooltip = screen.getByLabelText('Help tooltip');
    expect(tooltip).toHaveAttribute('title', 'Tooltip title');
    expect(tooltip).toHaveTextContent('Helpful context');
    expect(container.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized labels and preserves element children', () => {
    const { container } = render(
      <TooltipContent
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      >
        {'\u001b]0;Hidden prefix\u0007\u001b[33mPrefix\u001b[0m\u0000'}
        <span>Trusted child</span>
      </TooltipContent>
    );

    const child = screen.getByText('Trusted child');
    const tooltip = child.closest('div');
    expect(screen.getByText('Prefix')).toBeInTheDocument();
    expect(tooltip).not.toHaveAttribute('aria-label');
    expect(tooltip).not.toHaveAttribute('title');
    expect(container.textContent).not.toContain('Hidden');
  });
});
