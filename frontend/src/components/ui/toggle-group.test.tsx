import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-toggle-group', async () => {
  const React = await import('react');

  type RootProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    type?: 'single' | 'multiple';
    value?: string | string[];
  };

  const Root = React.forwardRef<HTMLDivElement, RootProps>(
    ({ children, type, value, ...props }, ref) => (
      <div
        ref={ref}
        role='group'
        data-type={type}
        data-value={Array.isArray(value) ? value.join(',') : value}
        data-testid='root'
        {...props}
      >
        {children}
      </div>
    )
  );
  Root.displayName = 'Root';

  type ItemProps = ReactTypes.ButtonHTMLAttributes<HTMLButtonElement> & {
    value?: string;
  };

  const Item = React.forwardRef<HTMLButtonElement, ItemProps>(
    ({ children, value, ...props }, ref) => (
      <button
        ref={ref}
        data-value={value}
        data-testid='item'
        type='button'
        {...props}
      >
        {children}
      </button>
    )
  );
  Item.displayName = 'Item';

  return {
    Root,
    Item,
  };
});

import { ToggleGroup, ToggleGroupItem } from './toggle-group';

describe('ToggleGroup text boundaries', () => {
  it('sanitizes group and item text/accessibility attributes while preserving type/value props', () => {
    render(
      <ToggleGroup
        type='single'
        value='bold'
        variant='outline'
        aria-label={'\u001b]0;Hidden group\u0007\u001b[31mFormatting\u0000 controls'}
        title={'\u001b]0;Hidden formatting\u0007\u001b[32mFormatting\u0007'}
      >
        <ToggleGroupItem
          value='bold'
          aria-label={'\u001b]0;Hidden item\u0007\u001b[33mBold\u0000'}
          title={'\u001b]0;Hidden option\u0007\u001b[34mBold option\u0007'}
        >
          {'\u001b]0;Hidden text\u0007\u001b[35mBold\u0000'}
        </ToggleGroupItem>
      </ToggleGroup>
    );

    expect(screen.getByRole('group')).toHaveAttribute(
      'aria-label',
      'Formatting controls'
    );
    expect(screen.getByRole('group')).toHaveAttribute('title', 'Formatting');
    expect(screen.getByRole('group')).toHaveAttribute('data-type', 'single');
    expect(screen.getByRole('group')).toHaveAttribute('data-value', 'bold');

    const item = screen.getByRole('button', { name: 'Bold' });

    expect(item).toHaveAttribute('title', 'Bold option');
    expect(item).toHaveAttribute('data-value', 'bold');
    expect(item).toHaveTextContent('Bold');
    expect(item.textContent).not.toContain('\u001b');
    expect(item.textContent).not.toContain('Hidden');
    expect(item.className).toContain('border');
  });

  it('sanitizes direct group string children and preserves rich item children', () => {
    render(
      <ToggleGroup type='multiple' aria-label='formatting'>
        {'\u001b]0;Hidden group text\u0007\u001b[31mRaw group text\u0000'}
        <ToggleGroupItem value='italic'>
          <span data-testid='rich-child'>{'\u001b[32mKeep\u0007 raw'}</span>
        </ToggleGroupItem>
      </ToggleGroup>
    );

    expect(screen.getByRole('group')).toHaveTextContent('Raw group text');
    expect(screen.getByRole('group').textContent).not.toContain('Hidden');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[32mKeep\u0007 raw'
    );
  });

  it('omits empty sanitized accessibility text', () => {
    render(
      <ToggleGroup
        type='single'
        aria-label={'\u001b]0;Hidden group\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      >
        <ToggleGroupItem
          value='empty'
          aria-label={'\u001b]0;Hidden item\u0007\u001b[32m\u0000'}
          title={'\u0008'}
        />
      </ToggleGroup>
    );

    expect(screen.getByTestId('root')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('root')).not.toHaveAttribute('title');
    expect(screen.getByTestId('item')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('item')).not.toHaveAttribute('title');
  });
});
