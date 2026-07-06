import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-radio-group', async () => {
  const React = await import('react');

  type RootProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    defaultValue?: string;
    value?: string;
  };

  const Root = React.forwardRef<HTMLDivElement, RootProps>(
    ({ children, defaultValue, value, ...props }, ref) => (
      <div
        ref={ref}
        role='radiogroup'
        data-default-value={defaultValue}
        data-value={value}
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
        role='radio'
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

  const Indicator = ({
    children,
    ...props
  }: ReactTypes.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid='indicator' {...props}>
      {children}
    </span>
  );
  Indicator.displayName = 'Indicator';

  return {
    Root,
    Item,
    Indicator,
  };
});

import { RadioGroup, RadioGroupItem } from './radio-group';

describe('RadioGroup text boundaries', () => {
  it('sanitizes group labels while preserving selected value props', () => {
    render(
      <RadioGroup
        defaultValue='daily'
        aria-label={'\u001b]0;Hidden group\u0007\u001b[31mNotification\u0000 frequency'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mFrequency\u0007'}
      >
        <RadioGroupItem
          value='daily'
          aria-label={'\u001b]0;Hidden item\u0007\u001b[33mDaily\u0000'}
          title={'\u001b]0;Hidden item title\u0007\u001b[34mDaily option\u0007'}
        />
      </RadioGroup>
    );

    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'aria-label',
      'Notification frequency'
    );
    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'title',
      'Frequency'
    );
    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'data-default-value',
      'daily'
    );

    const item = screen.getByRole('radio', { name: 'Daily' });

    expect(item).toHaveAttribute('title', 'Daily option');
    expect(item.getAttribute('aria-label')).not.toContain('Hidden');
    expect(item.getAttribute('title')).not.toContain('Hidden');
    expect(item).toHaveAttribute('data-value', 'daily');
    expect(screen.getByTestId('indicator')).toBeInTheDocument();
  });

  it('sanitizes direct string children but preserves rich child nodes', () => {
    render(
      <RadioGroup aria-label='choices'>
        {'\u001b]0;Hidden group text\u0007\u001b[31mRaw group text\u0000'}
        <RadioGroupItem value='custom'>
          {'\u001b]0;Hidden item text\u0007\u001b[32mCustom\u0007'}
          <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
        </RadioGroupItem>
      </RadioGroup>
    );

    expect(screen.getByRole('radiogroup')).toHaveTextContent('Raw group text');
    expect(screen.getByTestId('item')).toHaveTextContent('Custom');
    expect(screen.getByRole('radiogroup').textContent).not.toContain('Hidden');
    expect(screen.getByTestId('item').textContent).not.toContain('Hidden');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });

  it('omits empty sanitized accessibility text', () => {
    render(
      <RadioGroup
        aria-label={'\u001b]0;Hidden group\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      >
        <RadioGroupItem
          value='empty'
          aria-label={'\u001b]0;Hidden item\u0007\u001b[32m\u0000'}
          title={'\u0008'}
        />
      </RadioGroup>
    );

    expect(screen.getByTestId('root')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('root')).not.toHaveAttribute('title');
    expect(screen.getByTestId('item')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('item')).not.toHaveAttribute('title');
  });
});
