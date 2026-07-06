import type { ReactNode } from 'react';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DialogContent, DialogDescription, DialogTitle } from './dialog';

vi.mock('@radix-ui/react-dialog', () => {
  const makePrimitive = (tag: 'div' | 'button') =>
    React.forwardRef<HTMLElement, Record<string, unknown> & { children?: ReactNode }>(
      ({ children, ...props }, ref) =>
        React.createElement(tag, { ref, ...props }, children)
    );

  return {
    Root: ({ children }: { children: ReactNode }) => <>{children}</>,
    Trigger: makePrimitive('button'),
    Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
    Overlay: makePrimitive('div'),
    Content: makePrimitive('div'),
    Close: makePrimitive('button'),
    Title: makePrimitive('div'),
    Description: makePrimitive('div'),
  };
});

describe('Dialog primitives', () => {
  it('sanitizes content accessibility labels and title/description text', () => {
    const { container } = render(
      <DialogContent
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31mSettings dialog\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mDialog title\u001b[0m\u0007'}
      >
        <DialogTitle>
          {'\u001b]0;Hidden heading\u0007\u001b[33mSettings\u001b[0m\u0000'}
        </DialogTitle>
        <DialogDescription>
          {'\u001b]0;Hidden description\u0007\u001b[34mConfigure preferences\u001b[0m\u0007'}
        </DialogDescription>
      </DialogContent>
    );

    const content = screen.getByLabelText('Settings dialog');
    expect(content).toHaveAttribute('title', 'Dialog title');
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Configure preferences')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized content labels and preserves element children', () => {
    const { container } = render(
      <DialogContent
        hideClose
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      >
        <DialogDescription>
          {'\u001b]0;Hidden prefix\u0007\u001b[33mPrefix\u001b[0m\u0000'}
          <span>Trusted child</span>
        </DialogDescription>
      </DialogContent>
    );

    const child = screen.getByText('Trusted child');
    expect(screen.getByText('Prefix')).toBeInTheDocument();
    expect(container.querySelector('[aria-label]')).toBeNull();
    expect(container.querySelector('[title]')).toBeNull();
    expect(child.closest('div')?.textContent).toContain('Trusted child');
    expect(container.textContent).not.toContain('Hidden');
  });
});
