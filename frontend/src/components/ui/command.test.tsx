import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('cmdk', async () => {
  const React = await import('react');

  const Root = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='command' {...props}>
      {children}
    </div>
  ));
  Root.displayName = 'Command';

  const Input = React.forwardRef<
    HTMLInputElement,
    ReactTypes.InputHTMLAttributes<HTMLInputElement>
  >((props, ref) => <input ref={ref} data-testid='input' {...props} />);
  Input.displayName = 'Input';

  const List = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='list' {...props}>
      {children}
    </div>
  ));
  List.displayName = 'List';

  const Empty = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='empty' {...props}>
      {children}
    </div>
  ));
  Empty.displayName = 'Empty';

  type GroupProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    heading?: ReactTypes.ReactNode;
  };

  const Group = React.forwardRef<HTMLDivElement, GroupProps>(
    ({ children, heading, ...props }, ref) => (
      <div ref={ref} data-testid='group' {...props}>
        <div data-testid='heading'>{heading}</div>
        {children}
      </div>
    )
  );
  Group.displayName = 'Group';

  const Separator = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >((props, ref) => <div ref={ref} data-testid='separator' {...props} />);
  Separator.displayName = 'Separator';

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

  const Command = Object.assign(Root, {
    Empty,
    Group,
    Input,
    Item,
    List,
    Separator,
  });

  return { Command };
});

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './command';

describe('Command text boundaries', () => {
  it('sanitizes command root, input, list, and empty text/accessibility attributes', () => {
    render(
      <Command
        aria-label={'\u001b]0;Hidden command\u0007\u001b[31mCommand\u0000 menu'}
        title={'\u001b]2;Hidden title\u001b\\\u001b[32mCommands\u0007'}
      >
        <CommandInput
          aria-label={'\u001b]0;Hidden input\u0007\u001b[33mSearch\u0000 commands'}
          placeholder={'\u001b]0;Hidden placeholder\u0007\u001b[34mType command\u0007'}
          title={'\u001b]0;Hidden input title\u0007\u001b[35mSearch\u0000'}
        />
        <CommandList
          aria-label={'\u001b]0;Hidden list\u0007\u001b[36mResults\u0007'}
          title={'\u001b]0;Hidden list title\u0007\u001b[31mResult list\u0000'}
        >
          <CommandEmpty>
            {'\u001b]0;Hidden empty text\u0007\u001b[32mNo results\u0007'}
          </CommandEmpty>
        </CommandList>
      </Command>
    );

    expect(screen.getByTestId('command')).toHaveAttribute(
      'aria-label',
      'Command menu'
    );
    expect(screen.getByTestId('command')).toHaveAttribute('title', 'Commands');
    expect(screen.getByRole('textbox', { name: 'Search commands' })).toHaveAttribute(
      'placeholder',
      'Type command'
    );
    expect(screen.getByRole('textbox', { name: 'Search commands' })).toHaveAttribute(
      'title',
      'Search'
    );
    expect(screen.getByTestId('list')).toHaveAttribute('aria-label', 'Results');
    expect(screen.getByTestId('list')).toHaveAttribute('title', 'Result list');
    expect(screen.getByTestId('empty')).toHaveTextContent('No results');
    expect(screen.getByTestId('empty').textContent).not.toContain('\u001b');
    expect(screen.getByTestId('empty').textContent).not.toContain('Hidden');
  });

  it('sanitizes group heading, item labels, shortcut labels, and separator labels while preserving item value', () => {
    render(
      <Command>
        <CommandGroup
          heading={'\u001b]0;Hidden heading\u0007\u001b[31mActions\u0000'}
          aria-label={'\u001b]0;Hidden group\u0007\u001b[32mAction group\u0007'}
          title={'\u001b]2;Hidden group title\u001b\\\u001b[33mActions\u0000'}
        >
          <CommandItem
            value='open-file'
            aria-label={'\u001b]0;Hidden item\u0007\u001b[34mOpen file\u0007'}
            title={'\u001b]0;Hidden item title\u0007\u001b[35mOpen\u0000'}
          >
            {'\u001b]0;Hidden item text\u0007\u001b[36mOpen\u0007'}
            <CommandShortcut
              aria-label={'\u001b]0;Hidden shortcut\u0007\u001b[31mShortcut\u0000'}
              title={'\u001b]0;Hidden shortcut title\u0007\u001b[32mCtrl O\u0007'}
            >
              {'\u001b]0;Hidden shortcut text\u0007\u001b[33mCtrl O\u0000'}
            </CommandShortcut>
          </CommandItem>
          <CommandSeparator
            aria-label={'\u001b]0;Hidden separator\u0007\u001b[34mSeparator\u0007'}
            title={'\u001b]0;Hidden separator title\u0007\u001b[35mBreak\u0000'}
          />
        </CommandGroup>
      </Command>
    );

    expect(screen.getByTestId('group')).toHaveAttribute(
      'aria-label',
      'Action group'
    );
    expect(screen.getByTestId('group')).toHaveAttribute('title', 'Actions');
    expect(screen.getByTestId('heading')).toHaveTextContent('Actions');
    expect(screen.getByTestId('heading').textContent).not.toContain('Hidden');
    expect(screen.getByTestId('item')).toHaveAttribute('data-value', 'open-file');
    expect(screen.getByTestId('item')).toHaveAttribute('aria-label', 'Open file');
    expect(screen.getByTestId('item')).toHaveAttribute('title', 'Open');
    expect(screen.getByTestId('item')).toHaveTextContent('Open');
    expect(screen.getByTestId('item').textContent).not.toContain('Hidden');
    expect(screen.getByText('Ctrl O')).toHaveAttribute('aria-label', 'Shortcut');
    expect(screen.getByText('Ctrl O')).toHaveAttribute('title', 'Ctrl O');
    expect(screen.getByTestId('separator')).toHaveAttribute(
      'aria-label',
      'Separator'
    );
    expect(screen.getByTestId('separator')).toHaveAttribute('title', 'Break');
  });

  it('omits empty sanitized accessibility text and preserves rich child nodes', () => {
    render(
      <Command
        aria-label={'\u001b]0;Hidden empty label\u0007\u001b[31m\u0000'}
        title={'\u001b]0;Hidden empty title\u0007\u0007'}
      >
        <CommandItem value='rich'>
          <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
        </CommandItem>
      </Command>
    );

    expect(screen.getByTestId('command')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('command')).not.toHaveAttribute('title');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
