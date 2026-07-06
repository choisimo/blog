import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-menubar', async () => {
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

  const Root = createDiv('menubar');

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
    Root,
    Menu: ({ children }: { children?: ReactTypes.ReactNode }) => (
      <div>{children}</div>
    ),
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
    Trigger,
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
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarRadioItem,
  MenubarShortcut,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from './menubar';

describe('Menubar text boundaries', () => {
  it('sanitizes root and trigger text/accessibility attributes', () => {
    render(
      <Menubar
        aria-label={'\u001b]0;Hidden menubar\u0007\u001b[31mApplication\u0000 menu'}
        title={'\u001b]2;Hidden menubar title\u001b\\\u001b[32mMain\u0007 menu'}
      >
        <MenubarTrigger
          aria-label={'\u001b]0;Hidden trigger\u0007\u001b[33mFile\u0000 menu'}
          title={'\u001b]0;Hidden trigger title\u0007\u001b[34mFile\u0007'}
        >
          {'\u001b]0;Hidden trigger text\u0007\u001b[35mFile\u0000'}
        </MenubarTrigger>
      </Menubar>
    );

    expect(screen.getByTestId('menubar')).toHaveAttribute(
      'aria-label',
      'Application menu'
    );
    expect(screen.getByTestId('menubar')).toHaveAttribute('title', 'Main menu');

    const trigger = screen.getByRole('button', { name: 'File menu' });

    expect(trigger).toHaveAttribute('title', 'File');
    expect(trigger).toHaveTextContent('File');
    expect(trigger.textContent).not.toContain('\u001b');
    expect(trigger.textContent).not.toContain('Hidden');
  });

  it('sanitizes menu item labels, shortcuts, and content labels', () => {
    render(
      <MenubarContent
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31mFile options\u0000'}
        title={'\u001b]2;Hidden content title\u001b\\\u001b[32mMenu\u0007'}
      >
        <MenubarItem
          aria-label={'\u001b]0;Hidden item\u0007\u001b[33mOpen\u0000'}
          title={'\u001b]0;Hidden item title\u0007\u001b[34mOpen\u0007'}
        >
          {'\u001b]0;Hidden item text\u0007\u001b[35mOpen\u0000'}
        </MenubarItem>
        <MenubarCheckboxItem checked>
          {'\u001b]0;Hidden checkbox text\u0007\u001b[36mShow\u0007 sidebar'}
        </MenubarCheckboxItem>
        <MenubarRadioItem value='compact'>
          {'\u001b]0;Hidden radio text\u0007\u001b[31mCompact\u0000'}
        </MenubarRadioItem>
        <MenubarLabel>
          {'\u001b]0;Hidden label text\u0007\u001b[32mView\u0007'}
        </MenubarLabel>
        <MenubarShortcut
          aria-label={'\u001b]0;Hidden shortcut\u0007\u001b[33mShortcut\u0000'}
          title={'\u001b]0;Hidden shortcut title\u0007\u001b[34mCtrl O\u0007'}
        >
          {'\u001b]0;Hidden shortcut text\u0007\u001b[35mCtrl O\u0000'}
        </MenubarShortcut>
      </MenubarContent>
    );

    expect(screen.getByTestId('content')).toHaveAttribute(
      'aria-label',
      'File options'
    );
    expect(screen.getByTestId('content')).toHaveAttribute('title', 'Menu');
    expect(screen.getByTestId('item')).toHaveAttribute('aria-label', 'Open');
    expect(screen.getByTestId('item')).toHaveAttribute('title', 'Open');
    expect(screen.getByTestId('item')).toHaveTextContent('Open');
    expect(screen.getByTestId('checkbox-item')).toHaveTextContent(
      'Show sidebar'
    );
    expect(screen.getByTestId('radio-item')).toHaveTextContent('Compact');
    expect(screen.getByTestId('label')).toHaveTextContent('View');
    expect(screen.getByText('Ctrl O')).toHaveAttribute(
      'aria-label',
      'Shortcut'
    );
    expect(screen.getByText('Ctrl O')).toHaveAttribute('title', 'Ctrl O');
    expect(screen.getByTestId('content').textContent).not.toContain('Hidden');
  });

  it('sanitizes submenu containers while preserving rich child nodes', () => {
    render(
      <>
        <MenubarSubTrigger
          aria-label={'\u001b]0;Hidden sub trigger\u0007\u001b[31mMore\u0000'}
          title={'\u001b]2;Hidden sub trigger title\u001b\\\u001b[32mMore options\u0007'}
        >
          {'\u001b]0;Hidden sub trigger text\u0007\u001b[33mMore\u0000'}
        </MenubarSubTrigger>
        <MenubarSubContent
          aria-label={'\u001b]0;Hidden sub content\u0007\u001b[34mNested\u0000'}
          title={'\u001b]0;Hidden sub content title\u0007\u001b[35mNested menu\u0007'}
        >
          <span data-testid='rich-child'>{'\u001b[36mKeep\u0000 raw'}</span>
        </MenubarSubContent>
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
