import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-dropdown-menu', async () => {
  const React = await import('react');

  const createDiv = (testId: string) => {
    const Component = React.forwardRef<
      HTMLDivElement,
      ReactTypes.HTMLAttributes<HTMLDivElement>
    >(({ children, ...props }, ref) => (
      <div ref={ref} data-testid={testId} {...props}>
        {children}
      </div>
    ));
    Component.displayName = testId;
    return Component;
  };

  const Trigger = React.forwardRef<
    HTMLButtonElement,
    ReactTypes.ButtonHTMLAttributes<HTMLButtonElement>
  >(({ children, ...props }, ref) => (
    <button ref={ref} data-testid='trigger' {...props}>
      {children}
    </button>
  ));
  Trigger.displayName = 'Trigger';

  const Separator = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >((props, ref) => <div ref={ref} data-testid='separator' {...props} />);
  Separator.displayName = 'Separator';

  return {
    Root: ({ children }: { children?: ReactTypes.ReactNode }) => (
      <div>{children}</div>
    ),
    Trigger,
    Group: ({ children }: { children?: ReactTypes.ReactNode }) => (
      <div>{children}</div>
    ),
    Portal: ({ children }: { children?: ReactTypes.ReactNode }) => (
      <>{children}</>
    ),
    Sub: ({ children }: { children?: ReactTypes.ReactNode }) => (
      <div>{children}</div>
    ),
    RadioGroup: ({ children }: { children?: ReactTypes.ReactNode }) => (
      <div>{children}</div>
    ),
    SubTrigger: createDiv('sub-trigger'),
    SubContent: createDiv('sub-content'),
    Content: createDiv('content'),
    Item: createDiv('item'),
    CheckboxItem: createDiv('checkbox-item'),
    RadioItem: createDiv('radio-item'),
    Label: createDiv('label'),
    Separator,
    ItemIndicator: ({ children }: { children?: ReactTypes.ReactNode }) => (
      <span data-testid='item-indicator'>{children}</span>
    ),
  };
});

import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';

describe('DropdownMenu text boundaries', () => {
  it('sanitizes trigger text and accessibility attributes', () => {
    render(
      <DropdownMenuTrigger
        aria-label={'\u001b]0;Hidden trigger\u0007\u001b[31mOpen\u0000 menu'}
        title={'\u001b]2;Hidden trigger title\u001b\\\u001b[32mMain\u0007 menu'}
      >
        {'\u001b]0;Hidden trigger text\u0007\u001b[33mOpen\u0000 menu'}
      </DropdownMenuTrigger>
    );

    const trigger = screen.getByRole('button', { name: 'Open menu' });

    expect(trigger).toHaveAttribute('title', 'Main menu');
    expect(trigger).toHaveTextContent('Open menu');
    expect(trigger.textContent).not.toContain('\u001b');
    expect(trigger.textContent).not.toContain('Hidden');
  });

  it('sanitizes menu item labels, shortcuts, and content labels', () => {
    render(
      <DropdownMenuContent
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31mOptions\u0000'}
        title={'\u001b]2;Hidden content title\u001b\\\u001b[32mMenu\u0007'}
      >
        <DropdownMenuItem
          aria-label={'\u001b]0;Hidden item\u0007\u001b[33mDelete\u0000'}
          title={'\u001b]0;Hidden item title\u0007\u001b[34mDelete\u0007'}
        >
          {'\u001b]0;Hidden item text\u0007\u001b[35mDelete\u0000'}
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem checked>
          {'\u001b]0;Hidden checkbox text\u0007\u001b[36mEmail\u0007 alerts'}
        </DropdownMenuCheckboxItem>
        <DropdownMenuRadioItem value='daily'>
          {'\u001b]0;Hidden radio text\u0007\u001b[31mDaily\u0000'}
        </DropdownMenuRadioItem>
        <DropdownMenuLabel>
          {'\u001b]0;Hidden label text\u0007\u001b[32mSettings\u0007'}
        </DropdownMenuLabel>
        <DropdownMenuShortcut
          aria-label={'\u001b]0;Hidden shortcut\u0007\u001b[33mShortcut\u0000'}
          title={'\u001b]0;Hidden shortcut title\u0007\u001b[34mCtrl K\u0007'}
        >
          {'\u001b]0;Hidden shortcut text\u0007\u001b[35mCtrl K\u0000'}
        </DropdownMenuShortcut>
      </DropdownMenuContent>
    );

    expect(screen.getByTestId('content')).toHaveAttribute(
      'aria-label',
      'Options'
    );
    expect(screen.getByTestId('content')).toHaveAttribute('title', 'Menu');
    expect(screen.getByTestId('item')).toHaveAttribute(
      'aria-label',
      'Delete'
    );
    expect(screen.getByTestId('item')).toHaveAttribute('title', 'Delete');
    expect(screen.getByTestId('item')).toHaveTextContent('Delete');
    expect(screen.getByTestId('checkbox-item')).toHaveTextContent(
      'Email alerts'
    );
    expect(screen.getByTestId('radio-item')).toHaveTextContent('Daily');
    expect(screen.getByTestId('label')).toHaveTextContent('Settings');
    expect(screen.getByText('Ctrl K')).toHaveAttribute(
      'aria-label',
      'Shortcut'
    );
    expect(screen.getByText('Ctrl K')).toHaveAttribute('title', 'Ctrl K');
    expect(screen.getByTestId('content').textContent).not.toContain('Hidden');
  });

  it('sanitizes submenu containers while preserving rich child nodes', () => {
    render(
      <>
        <DropdownMenuSubTrigger
          aria-label={'\u001b]0;Hidden sub trigger\u0007\u001b[31mMore\u0000'}
          title={'\u001b]2;Hidden sub trigger title\u001b\\\u001b[32mMore options\u0007'}
        >
          {'\u001b]0;Hidden sub trigger text\u0007\u001b[33mMore\u0000'}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent
          aria-label={'\u001b]0;Hidden sub content\u0007\u001b[34mNested\u0000'}
          title={'\u001b]0;Hidden sub content title\u0007\u001b[35mNested menu\u0007'}
        >
          <span data-testid='rich-child'>{'\u001b[36mKeep\u0000 raw'}</span>
        </DropdownMenuSubContent>
      </>
    );

    expect(screen.getByTestId('sub-trigger')).toHaveAttribute(
      'aria-label',
      'More'
    );
    expect(screen.getByTestId('sub-trigger')).toHaveAttribute(
      'title',
      'More options'
    );
    expect(screen.getByTestId('sub-trigger')).toHaveTextContent('More');
    expect(screen.getByTestId('sub-trigger').textContent).not.toContain(
      'Hidden'
    );
    expect(screen.getByTestId('sub-content')).toHaveAttribute(
      'aria-label',
      'Nested'
    );
    expect(screen.getByTestId('sub-content')).toHaveAttribute(
      'title',
      'Nested menu'
    );
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[36mKeep\u0000 raw'
    );
  });
});
