import type { ReactNode } from 'react';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastTitle,
} from './toast';

vi.mock('@radix-ui/react-toast', () => {
  const makePrimitive = (tag: 'div' | 'button') =>
    React.forwardRef<
      HTMLElement,
      React.HTMLAttributes<HTMLElement> & { children?: ReactNode }
    >(
      ({ children, ...props }, ref) =>
        React.createElement(tag, { ref, ...props }, children)
    );

  return {
    Provider: ({ children }: { children: ReactNode }) => <>{children}</>,
    Viewport: makePrimitive('div'),
    Root: makePrimitive('div'),
    Action: makePrimitive('button'),
    Close: makePrimitive('button'),
    Title: makePrimitive('div'),
    Description: makePrimitive('div'),
  };
});

describe('toast primitives', () => {
  it('sanitizes title and description string children', () => {
    const { container } = render(
      <>
        <ToastTitle>
          {'\u001b]0;Hidden title\u0007\u001b[31mSaved\u001b[0m\u0000'}
        </ToastTitle>
        <ToastDescription>
          {'\u001b]0;Hidden description\u0007\u001b[32mYour changes are safe\u001b[0m\u0007'}
        </ToastDescription>
      </>
    );

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Your changes are safe')).toBeInTheDocument();
    expect(screen.queryByText(/\u001b/)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
  });

  it('sanitizes toast action labels and accessible text', () => {
    const { container } = render(
      <ToastAction
        altText='Undo'
        aria-label={'\u001b]0;Hidden action label\u0007\u001b[31mUndo action\u001b[0m\u0000'}
        title={'\u001b]0;Hidden action title\u0007\u001b[32mUndo title\u001b[0m\u0007'}
      >
        {'\u001b]0;Hidden action text\u0007\u001b[33mUndo\u001b[0m\u0000'}
      </ToastAction>
    );

    const action = screen.getByRole('button', { name: 'Undo action' });
    expect(action).toHaveTextContent('Undo');
    expect(action).toHaveAttribute('aria-label', 'Undo action');
    expect(action).toHaveAttribute('title', 'Undo title');
    expect(container.textContent).not.toContain('Hidden');
  });

  it('sanitizes close accessible labels and defaults empty labels', () => {
    const { rerender } = render(
      <ToastClose
        aria-label={'\u001b]0;Hidden close label\u0007\u001b[31mDismiss\u001b[0m\u0000'}
        title={'\u001b]0;Hidden close title\u0007\u001b[32mDismiss title\u001b[0m\u0007'}
      />
    );

    const close = screen.getByRole('button', { name: 'Dismiss' });
    expect(close).toHaveAttribute('title', 'Dismiss title');
    expect(close.getAttribute('aria-label')).not.toContain('Hidden');
    expect(close.getAttribute('title')).not.toContain('Hidden');

    rerender(
      <ToastClose
        aria-label={'\u001b]0;Hidden close label\u0007\u001b[31m\u001b[0m\u0000'}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Close notification' })
    ).toBeInTheDocument();
  });
});
