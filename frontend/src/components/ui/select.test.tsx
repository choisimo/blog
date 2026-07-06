import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-select', async () => {
  const React = await import('react');

  type RootProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    defaultValue?: string;
    value?: string;
  };

  const Root = React.forwardRef<HTMLDivElement, RootProps>(
    ({ children, defaultValue, value, ...props }, ref) => (
      <div
        ref={ref}
        data-default-value={defaultValue}
        data-testid='root'
        data-value={value}
        {...props}
      >
        {children}
      </div>
    )
  );
  Root.displayName = 'Root';

  const Group = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='group' {...props}>
      {children}
    </div>
  ));
  Group.displayName = 'Group';

  type ValueProps = ReactTypes.HTMLAttributes<HTMLSpanElement> & {
    placeholder?: ReactTypes.ReactNode;
  };

  const Value = React.forwardRef<HTMLSpanElement, ValueProps>(
    ({ children, placeholder, ...props }, ref) => (
      <span ref={ref} data-placeholder={placeholder} data-testid='value' {...props}>
        {children ?? placeholder}
      </span>
    )
  );
  Value.displayName = 'Value';

  const Trigger = React.forwardRef<
    HTMLButtonElement,
    ReactTypes.ButtonHTMLAttributes<HTMLButtonElement>
  >(({ children, ...props }, ref) => (
    <button ref={ref} data-testid='trigger' type='button' {...props}>
      {children}
    </button>
  ));
  Trigger.displayName = 'Trigger';

  const Icon = ({ children }: { children?: ReactTypes.ReactNode }) => (
    <span data-testid='icon'>{children}</span>
  );
  Icon.displayName = 'Icon';

  const Portal = ({ children }: { children?: ReactTypes.ReactNode }) => (
    <>{children}</>
  );

  type ContentProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    position?: string;
  };

  const Content = React.forwardRef<HTMLDivElement, ContentProps>(
    ({ children, position, ...props }, ref) => (
      <div ref={ref} data-position={position} data-testid='content' {...props}>
        {children}
      </div>
    )
  );
  Content.displayName = 'Content';

  const Viewport = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='viewport' {...props}>
      {children}
    </div>
  ));
  Viewport.displayName = 'Viewport';

  const ScrollUpButton = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='scroll-up' {...props}>
      {children}
    </div>
  ));
  ScrollUpButton.displayName = 'ScrollUpButton';

  const ScrollDownButton = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='scroll-down' {...props}>
      {children}
    </div>
  ));
  ScrollDownButton.displayName = 'ScrollDownButton';

  const Label = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='label' {...props}>
      {children}
    </div>
  ));
  Label.displayName = 'Label';

  type ItemProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    value?: string;
  };

  const Item = React.forwardRef<HTMLDivElement, ItemProps>(
    ({ children, value, ...props }, ref) => (
      <div ref={ref} data-testid='item' data-value={value} {...props}>
        {children}
      </div>
    )
  );
  Item.displayName = 'Item';

  const ItemIndicator = ({ children }: { children?: ReactTypes.ReactNode }) => (
    <span data-testid='item-indicator'>{children}</span>
  );

  const ItemText = ({ children }: { children?: ReactTypes.ReactNode }) => (
    <span data-testid='item-text'>{children}</span>
  );

  const Separator = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >((props, ref) => <div ref={ref} data-testid='separator' {...props} />);
  Separator.displayName = 'Separator';

  return {
    Root,
    Group,
    Value,
    Trigger,
    Icon,
    Portal,
    Content,
    Viewport,
    ScrollUpButton,
    ScrollDownButton,
    Label,
    Item,
    ItemIndicator,
    ItemText,
    Separator,
  };
});

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';

describe('Select text boundaries', () => {
  it('sanitizes root, trigger, and value placeholder while preserving selected values', () => {
    render(
      <Select
        defaultValue='daily'
        aria-label={'\u001b]0;Hidden root\u0007\u001b[31mFrequency\u0000 select'}
        title={'\u001b]2;Hidden title\u001b\\\u001b[32mFrequency\u0007'}
      >
        <SelectTrigger
          aria-label={'\u001b]0;Hidden trigger\u0007\u001b[33mOpen\u0000 frequency'}
          title={'\u001b]0;Hidden trigger title\u0007\u001b[34mTrigger\u0007'}
        >
          <SelectValue
            placeholder={
              '\u001b]0;Hidden placeholder\u0007\u001b[35mChoose\u0000 frequency'
            }
          />
        </SelectTrigger>
      </Select>
    );

    expect(screen.getByTestId('root')).toHaveAttribute(
      'aria-label',
      'Frequency select'
    );
    expect(screen.getByTestId('root')).toHaveAttribute('title', 'Frequency');
    expect(screen.getByTestId('root')).toHaveAttribute(
      'data-default-value',
      'daily'
    );

    const trigger = screen.getByRole('button', { name: 'Open frequency' });

    expect(trigger).toHaveAttribute('title', 'Trigger');
    expect(screen.getByTestId('value')).toHaveAttribute(
      'data-placeholder',
      'Choose frequency'
    );
    expect(screen.getByTestId('value')).toHaveTextContent('Choose frequency');
    expect(screen.getByTestId('value').textContent).not.toContain('Hidden');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('sanitizes content, label, item, separator, and scroll button labels while preserving item values', () => {
    render(
      <>
        <SelectContent
          position='item-aligned'
          aria-label={'\u001b]0;Hidden content\u0007\u001b[31mOptions\u0000'}
          title={'\u001b]0;Hidden content title\u0007\u001b[32mMenu\u0007'}
        >
          <SelectGroup
            aria-label={'\u001b]2;Hidden group\u001b\\\u001b[33mSchedule\u0000 group'}
            title={'\u001b]0;Hidden group title\u0007\u001b[34mSchedule\u0007'}
          >
            <SelectLabel>
              {'\u001b]0;Hidden label text\u0007\u001b[35mSchedule\u0000'}
            </SelectLabel>
            <SelectItem
              value='daily'
              aria-label={'\u001b]0;Hidden item\u0007\u001b[36mDaily\u0007'}
              title={'\u001b]0;Hidden item title\u0007\u001b[31mDaily option\u0000'}
            >
              {'\u001b]0;Hidden item text\u0007\u001b[32mDaily\u0007'}
            </SelectItem>
            <SelectSeparator
              aria-label={'\u001b]0;Hidden separator\u0007\u001b[33mBreak\u0000'}
              title={'\u001b]0;Hidden separator title\u0007\u001b[34mSeparator\u0007'}
            />
          </SelectGroup>
        </SelectContent>
        <SelectScrollUpButton
          aria-label={'\u001b]0;Hidden scroll up\u0007\u001b[35mScroll up\u0000'}
          title={'\u001b]0;Hidden up title\u0007\u001b[36mUp\u0007'}
        />
        <SelectScrollDownButton
          aria-label={'\u001b]0;Hidden scroll down\u0007\u001b[31mScroll down\u0000'}
          title={'\u001b]0;Hidden down title\u0007\u001b[32mDown\u0007'}
        />
      </>
    );

    expect(screen.getByTestId('content')).toHaveAttribute(
      'aria-label',
      'Options'
    );
    expect(screen.getByTestId('content')).toHaveAttribute('title', 'Menu');
    expect(screen.getByTestId('content')).toHaveAttribute(
      'data-position',
      'item-aligned'
    );
    expect(screen.getByTestId('viewport')).toBeInTheDocument();
    expect(screen.getByTestId('group')).toHaveAttribute(
      'aria-label',
      'Schedule group'
    );
    expect(screen.getByTestId('label')).toHaveTextContent('Schedule');
    expect(screen.getByTestId('label').textContent).not.toContain('Hidden');
    expect(screen.getByTestId('item')).toHaveAttribute('data-value', 'daily');
    expect(screen.getByTestId('item')).toHaveAttribute('aria-label', 'Daily');
    expect(screen.getByTestId('item')).toHaveAttribute('title', 'Daily option');
    expect(screen.getByTestId('item-text')).toHaveTextContent('Daily');
    expect(screen.getByTestId('item-text').textContent).not.toContain('Hidden');
    expect(screen.getByTestId('separator')).toHaveAttribute(
      'aria-label',
      'Break'
    );
    expect(screen.getByTestId('separator')).toHaveAttribute('title', 'Separator');
    expect(screen.getAllByTestId('scroll-up')[1]).toHaveAttribute(
      'aria-label',
      'Scroll up'
    );
    expect(screen.getAllByTestId('scroll-down')[1]).toHaveAttribute(
      'title',
      'Down'
    );
  });

  it('omits empty sanitized accessibility text and preserves rich child nodes', () => {
    render(
      <Select
        aria-label={'\u001b]0;Hidden empty label\u0007\u001b[31m\u0000'}
        title={'\u001b]0;Hidden empty title\u0007\u0007'}
      >
        <SelectItem value='rich'>
          <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
        </SelectItem>
      </Select>
    );

    expect(screen.getByTestId('root')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('root')).not.toHaveAttribute('title');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
