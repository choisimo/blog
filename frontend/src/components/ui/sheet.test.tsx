import type { ReactNode } from 'react';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SheetContent, SheetDescription, SheetTitle } from './sheet';

vi.mock('@radix-ui/react-dialog', () => {
  const makePrimitive = (tag: 'div' | 'button') =>
    React.forwardRef<
      HTMLElement,
      React.HTMLAttributes<HTMLElement> & { children?: ReactNode }
    >(
      ({ children, ...props }, ref) =>
        React.createElement(tag, { ref, ...props }, children)
    );

  return {
    Root: ({ children }: { children: ReactNode }) => <>{children}</>,
    Trigger: makePrimitive('button'),
    Close: makePrimitive('button'),
    Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
    Overlay: makePrimitive('div'),
    Content: makePrimitive('div'),
    Title: makePrimitive('div'),
    Description: makePrimitive('div'),
  };
});

describe('Sheet primitives', () => {
  it('sanitizes content labels and title/description text', () => {
    const { container } = render(
      <SheetContent
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31mNavigation sheet\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mSheet title\u001b[0m\u0007'}
      >
        <SheetTitle>
          {'\u001b]0;Hidden heading\u0007\u001b[33mNavigation\u001b[0m\u0000'}
        </SheetTitle>
        <SheetDescription>
          {'\u001b]0;Hidden description\u0007\u001b[34mChoose a destination\u001b[0m\u0007'}
        </SheetDescription>
      </SheetContent>
    );

    const content = screen.getByLabelText('Navigation sheet');
    expect(content).toHaveAttribute('title', 'Sheet title');
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Choose a destination')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized content labels and preserves element children', () => {
    const { container } = render(
      <SheetContent
        hideClose
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      >
        <SheetDescription>
          {'\u001b]0;Hidden prefix\u0007\u001b[33mPrefix\u001b[0m\u0000'}
          <span>Trusted child</span>
        </SheetDescription>
      </SheetContent>
    );

    const child = screen.getByText('Trusted child');
    const content = child.closest('div');
    expect(screen.getByText('Prefix')).toBeInTheDocument();
    expect(content).not.toHaveAttribute('aria-label');
    expect(content).not.toHaveAttribute('title');
    expect(container.textContent).not.toContain('Hidden');
  });
});
