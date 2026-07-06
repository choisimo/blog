import type { ReactNode } from 'react';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HoverCardContent } from './hover-card';

vi.mock('@radix-ui/react-hover-card', () => {
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
    Content,
  };
});

describe('HoverCardContent', () => {
  it('sanitizes hover card text and accessibility labels', () => {
    const { container } = render(
      <HoverCardContent
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mAuthor hover card\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mHover title\u001b[0m\u0007'}
      >
        {'\u001b]0;Hidden child\u0007\u001b[33mAuthor details\u001b[0m\u0000'}
      </HoverCardContent>
    );

    const hoverCard = screen.getByLabelText('Author hover card');
    expect(hoverCard).toHaveAttribute('title', 'Hover title');
    expect(hoverCard).toHaveTextContent('Author details');
    expect(container.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized labels and preserves element children', () => {
    const { container } = render(
      <HoverCardContent
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      >
        {'\u001b]0;Hidden prefix\u0007\u001b[33mPrefix\u001b[0m\u0000'}
        <span>Trusted child</span>
      </HoverCardContent>
    );

    const child = screen.getByText('Trusted child');
    const hoverCard = child.closest('div');
    expect(screen.getByText('Prefix')).toBeInTheDocument();
    expect(hoverCard).not.toHaveAttribute('aria-label');
    expect(hoverCard).not.toHaveAttribute('title');
    expect(container.textContent).not.toContain('Hidden');
  });
});
