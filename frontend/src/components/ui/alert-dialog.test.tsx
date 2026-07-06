import type { ReactNode } from 'react';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from './alert-dialog';

vi.mock('@radix-ui/react-alert-dialog', () => {
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
    Title: makePrimitive('div'),
    Description: makePrimitive('div'),
    Action: makePrimitive('button'),
    Cancel: makePrimitive('button'),
  };
});

describe('AlertDialog primitives', () => {
  it('sanitizes content labels, title, description, action, and cancel text', () => {
    const { container } = render(
      <AlertDialogContent
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31mDelete dialog\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mDialog title\u001b[0m\u0007'}
      >
        <AlertDialogTitle>
          {'\u001b]0;Hidden heading\u0007\u001b[33mDelete item?\u001b[0m\u0000'}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {'\u001b]0;Hidden description\u0007\u001b[34mThis cannot be undone\u001b[0m\u0007'}
        </AlertDialogDescription>
        <AlertDialogAction
          aria-label={'\u001b]0;Hidden action\u0007\u001b[35mConfirm delete\u001b[0m\u0000'}
          title={'\u001b]0;Hidden action title\u0007\u001b[36mConfirm title\u001b[0m\u0007'}
        >
          {'\u001b]0;Hidden action text\u0007\u001b[31mDelete\u001b[0m\u0000'}
        </AlertDialogAction>
        <AlertDialogCancel>
          {'\u001b]0;Hidden cancel\u0007\u001b[32mCancel\u001b[0m\u0007'}
        </AlertDialogCancel>
      </AlertDialogContent>
    );

    const content = screen.getByLabelText('Delete dialog');
    const action = screen.getByRole('button', { name: 'Confirm delete' });

    expect(content).toHaveAttribute('title', 'Dialog title');
    expect(screen.getByText('Delete item?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone')).toBeInTheDocument();
    expect(action).toHaveAttribute('title', 'Confirm title');
    expect(action).toHaveTextContent('Delete');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized labels and preserves element children', () => {
    const { container } = render(
      <AlertDialogContent
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      >
        <AlertDialogDescription>
          {'\u001b]0;Hidden prefix\u0007\u001b[33mPrefix\u001b[0m\u0000'}
          <span>Trusted child</span>
        </AlertDialogDescription>
      </AlertDialogContent>
    );

    const child = screen.getByText('Trusted child');
    expect(screen.getByText('Prefix')).toBeInTheDocument();
    expect(container.querySelector('[aria-label]')).toBeNull();
    expect(container.querySelector('[title]')).toBeNull();
    expect(child.closest('div')?.textContent).toContain('Trusted child');
    expect(container.textContent).not.toContain('Hidden');
  });
});
