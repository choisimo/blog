import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-toggle', async () => {
  const React = await import('react');

  type RootProps = ReactTypes.ButtonHTMLAttributes<HTMLButtonElement> & {
    pressed?: boolean;
  };

  const Root = React.forwardRef<HTMLButtonElement, RootProps>(
    ({ children, pressed, ...props }, ref) => (
      <button
        ref={ref}
        aria-pressed={pressed}
        data-pressed={String(pressed)}
        data-testid='toggle'
        type='button'
        {...props}
      >
        {children}
      </button>
    )
  );
  Root.displayName = 'Root';

  return {
    Root,
  };
});

import { Toggle } from './toggle';

describe('Toggle text boundaries', () => {
  it('sanitizes toggle text/accessibility attributes while preserving pressed state', () => {
    render(
      <Toggle
        pressed
        variant='outline'
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mBold\u0000 format'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mBold\u0007 toggle'}
      >
        {'\u001b]0;Hidden child\u0007\u001b[33mBold\u0000'}
      </Toggle>
    );

    const toggle = screen.getByRole('button', { name: 'Bold format' });

    expect(toggle).toHaveAttribute('title', 'Bold toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('data-pressed', 'true');
    expect(toggle).toHaveTextContent('Bold');
    expect(toggle.textContent).not.toContain('\u001b');
    expect(toggle.textContent).not.toContain('Hidden');
    expect(toggle.className).toContain('border');
  });

  it('omits empty sanitized accessibility text', () => {
    render(
      <Toggle
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      />
    );

    const toggle = screen.getByTestId('toggle');

    expect(toggle).not.toHaveAttribute('aria-label');
    expect(toggle).not.toHaveAttribute('title');
    expect(toggle.textContent).not.toContain('Hidden');
  });

  it('preserves rich child nodes', () => {
    render(
      <Toggle>
        <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
      </Toggle>
    );

    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
