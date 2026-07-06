import type { ReactNode } from 'react';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DrawerContent, DrawerDescription, DrawerTitle } from './drawer';

vi.mock('vaul', () => {
  const makePrimitive = (tag: 'div' | 'button') =>
    React.forwardRef<HTMLElement, Record<string, unknown> & { children?: ReactNode }>(
      ({ children, ...props }, ref) =>
        React.createElement(tag, { ref, ...props }, children)
    );

  return {
    Drawer: {
      Root: ({ children }: { children: ReactNode }) => <>{children}</>,
      Trigger: makePrimitive('button'),
      Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
      Close: makePrimitive('button'),
      Overlay: makePrimitive('div'),
      Content: makePrimitive('div'),
      Title: makePrimitive('div'),
      Description: makePrimitive('div'),
    },
  };
});

describe('Drawer primitives', () => {
  it('sanitizes content labels and title/description text', () => {
    const { container } = render(
      <DrawerContent
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31mAction drawer\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mDrawer title\u001b[0m\u0007'}
      >
        <DrawerTitle>
          {'\u001b]0;Hidden heading\u0007\u001b[33mActions\u001b[0m\u0000'}
        </DrawerTitle>
        <DrawerDescription>
          {'\u001b]0;Hidden description\u0007\u001b[34mChoose an action\u001b[0m\u0007'}
        </DrawerDescription>
      </DrawerContent>
    );

    const content = screen.getByLabelText('Action drawer');
    expect(content).toHaveAttribute('title', 'Drawer title');
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Choose an action')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized content labels and preserves element children', () => {
    const { container } = render(
      <DrawerContent
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      >
        <DrawerDescription>
          {'\u001b]0;Hidden prefix\u0007\u001b[33mPrefix\u001b[0m\u0000'}
          <span>Trusted child</span>
        </DrawerDescription>
      </DrawerContent>
    );

    const child = screen.getByText('Trusted child');
    const content = child.closest('div');
    expect(screen.getByText('Prefix')).toBeInTheDocument();
    expect(content).not.toHaveAttribute('aria-label');
    expect(content).not.toHaveAttribute('title');
    expect(container.textContent).not.toContain('Hidden');
  });
});
