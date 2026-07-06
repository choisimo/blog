import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-context-menu', async () => {
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

  const Separator = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >((props, ref) => <div ref={ref} data-testid='separator' {...props} />);
  Separator.displayName = 'Separator';

  return {
    Root: ({ children }: { children?: ReactTypes.ReactNode }) => (
      <div>{children}</div>
    ),
    Trigger: createDiv('trigger'),
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
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioItem,
  ContextMenuShortcut,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from './context-menu';

describe('ContextMenu text boundaries', () => {
  it('sanitizes trigger text and accessibility attributes', () => {
    render(
      <ContextMenuTrigger
        aria-label={'\u001b]0;Hidden trigger\u0007\u001b[31mOpen\u0000 menu'}
        title={'\u001b]0;Hidden trigger title\u0007\u001b[32mMain\u0007 menu'}
      >
        {'\u001b]0;Hidden trigger text\u0007\u001b[33mOpen\u0000 menu'}
      </ContextMenuTrigger>
    );

    const trigger = screen.getByTestId('trigger');

    expect(trigger).toHaveAttribute('aria-label', 'Open menu');
    expect(trigger).toHaveAttribute('title', 'Main menu');
    expect(trigger).toHaveTextContent('Open menu');
    expect(trigger.textContent).not.toContain('\u001b');
    expect(trigger.textContent).not.toContain('Hidden');
  });

  it('sanitizes menu item labels, shortcuts, and content labels', () => {
    const { container } = render(
      <ContextMenuContent
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31mOptions\u0000'}
        title={'\u001b]0;Hidden menu\u0007\u001b[32mMenu\u0007'}
      >
        <ContextMenuItem
          aria-label={'\u001b]0;Hidden item\u0007\u001b[33mCopy\u0000'}
          title={'\u001b]0;Hidden item title\u0007\u001b[34mCopy\u0007'}
        >
          {'\u001b]0;Hidden item text\u0007\u001b[35mCopy\u0000'}
        </ContextMenuItem>
        <ContextMenuCheckboxItem checked>
          {'\u001b]0;Hidden checkbox\u0007\u001b[36mShow\u0007 details'}
        </ContextMenuCheckboxItem>
        <ContextMenuRadioItem value='grid'>
          {'\u001b]0;Hidden radio\u0007\u001b[31mGrid\u0000'}
        </ContextMenuRadioItem>
        <ContextMenuLabel>
          {'\u001b]0;Hidden label\u0007\u001b[32mLayout\u0007'}
        </ContextMenuLabel>
        <ContextMenuShortcut
          aria-label={'\u001b]0;Hidden shortcut\u0007\u001b[33mShortcut\u0000'}
          title={'\u001b]0;Hidden shortcut title\u0007\u001b[34mCtrl C\u0007'}
        >
          {'\u001b]0;Hidden shortcut text\u0007\u001b[35mCtrl C\u0000'}
        </ContextMenuShortcut>
      </ContextMenuContent>
    );

    expect(screen.getByTestId('content')).toHaveAttribute(
      'aria-label',
      'Options'
    );
    expect(screen.getByTestId('content')).toHaveAttribute('title', 'Menu');
    expect(screen.getByTestId('item')).toHaveAttribute('aria-label', 'Copy');
    expect(screen.getByTestId('item')).toHaveAttribute('title', 'Copy');
    expect(screen.getByTestId('item')).toHaveTextContent('Copy');
    expect(screen.getByTestId('checkbox-item')).toHaveTextContent(
      'Show details'
    );
    expect(screen.getByTestId('radio-item')).toHaveTextContent('Grid');
    expect(screen.getByTestId('label')).toHaveTextContent('Layout');
    expect(screen.getByText('Ctrl C')).toHaveAttribute(
      'aria-label',
      'Shortcut'
    );
    expect(screen.getByText('Ctrl C')).toHaveAttribute('title', 'Ctrl C');
    expect(container.textContent).not.toContain('Hidden');
  });

  it('sanitizes submenu containers while preserving rich child nodes', () => {
    render(
      <>
        <ContextMenuSubTrigger
          aria-label={'\u001b]0;Hidden sub trigger\u0007\u001b[31mMore\u0000'}
          title={'\u001b]0;Hidden sub title\u0007\u001b[32mMore options\u0007'}
        >
          {'\u001b]0;Hidden sub text\u0007\u001b[33mMore\u0000'}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent
          aria-label={'\u001b]0;Hidden nested\u0007\u001b[34mNested\u0000'}
          title={'\u001b]0;Hidden nested title\u0007\u001b[35mNested menu\u0007'}
        >
          <span data-testid='rich-child'>{'\u001b[36mKeep\u0000 raw'}</span>
        </ContextMenuSubContent>
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
