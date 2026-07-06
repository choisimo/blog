import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-navigation-menu', async () => {
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

  const List = React.forwardRef<
    HTMLUListElement,
    ReactTypes.HTMLAttributes<HTMLUListElement>
  >(({ children, ...props }, ref) => (
    <ul ref={ref} data-testid='list' {...props}>
      {children}
    </ul>
  ));
  List.displayName = 'List';

  const Item = React.forwardRef<
    HTMLLIElement,
    ReactTypes.LiHTMLAttributes<HTMLLIElement>
  >(({ children, ...props }, ref) => (
    <li ref={ref} data-testid='item' {...props}>
      {children}
    </li>
  ));
  Item.displayName = 'Item';

  const Trigger = React.forwardRef<
    HTMLButtonElement,
    ReactTypes.ButtonHTMLAttributes<HTMLButtonElement>
  >(({ children, ...props }, ref) => (
    <button ref={ref} data-testid='trigger' {...props}>
      {children}
    </button>
  ));
  Trigger.displayName = 'Trigger';

  const Link = React.forwardRef<
    HTMLAnchorElement,
    ReactTypes.AnchorHTMLAttributes<HTMLAnchorElement>
  >(({ children, ...props }, ref) => (
    <a ref={ref} data-testid='link' {...props}>
      {children}
    </a>
  ));
  Link.displayName = 'Link';

  return {
    Root: createDiv('root'),
    List,
    Item,
    Trigger,
    Content: createDiv('content'),
    Link,
    Viewport: createDiv('viewport'),
    Indicator: createDiv('indicator'),
  };
});

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from './navigation-menu';

describe('NavigationMenu text boundaries', () => {
  it('sanitizes root, list, item, and trigger text/accessibility attributes', () => {
    render(
      <NavigationMenu
        aria-label={'\u001b]0;Hidden root\u0007\u001b[31mPrimary\u0000 navigation'}
        title={'\u001b]2;Hidden title\u001b\\\u001b[32mMain\u0007 nav'}
      >
        <NavigationMenuList
          aria-label={'\u001b]0;Hidden list\u0007\u001b[33mSections\u0000'}
          title={'\u001b]0;Hidden list title\u0007\u001b[34mSection list\u0007'}
        >
          <NavigationMenuItem
            aria-label={'\u001b]0;Hidden item\u0007\u001b[35mProducts\u0000'}
            title={'\u001b]0;Hidden item title\u0007\u001b[36mProduct group\u0007'}
          >
            <NavigationMenuTrigger
              aria-label={'\u001b]0;Hidden trigger label\u0007\u001b[31mOpen products\u0000'}
              title={'\u001b]0;Hidden trigger title\u0007\u001b[32mProducts\u0007'}
            >
              {'\u001b]0;Hidden trigger text\u0007\u001b[33mProducts\u0000'}
            </NavigationMenuTrigger>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    );

    expect(screen.getByTestId('root')).toHaveAttribute(
      'aria-label',
      'Primary navigation'
    );
    expect(screen.getByTestId('root')).toHaveAttribute('title', 'Main nav');
    expect(screen.getByTestId('list')).toHaveAttribute(
      'aria-label',
      'Sections'
    );
    expect(screen.getByTestId('list')).toHaveAttribute('title', 'Section list');
    expect(screen.getByTestId('item')).toHaveAttribute(
      'aria-label',
      'Products'
    );
    expect(screen.getByTestId('item')).toHaveAttribute(
      'title',
      'Product group'
    );

    const trigger = screen.getByRole('button', { name: 'Open products' });
    expect(trigger).toHaveAttribute('title', 'Products');
    expect(trigger).toHaveTextContent('Products');
    expect(trigger.textContent).not.toContain('\u001b');
    expect(trigger.textContent).not.toContain('Hidden');
  });

  it('sanitizes content and link text while preserving rich child nodes', () => {
    render(
      <NavigationMenuContent
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31mContent\u0000'}
        title={'\u001b]0;Hidden content title\u0007\u001b[32mContent panel\u0007'}
      >
        <NavigationMenuLink
          href='/products'
          aria-label={'\u001b]0;Hidden link label\u0007\u001b[33mProducts link\u0000'}
          title={'\u001b]0;Hidden link title\u0007\u001b[34mProducts\u0007'}
        >
          {'\u001b]0;Hidden link text\u0007\u001b[35mProducts\u0000'}
        </NavigationMenuLink>
        <span data-testid='rich-child'>{'\u001b[36mKeep\u0000 raw'}</span>
      </NavigationMenuContent>
    );

    expect(screen.getByTestId('content')).toHaveAttribute(
      'aria-label',
      'Content'
    );
    expect(screen.getByTestId('content')).toHaveAttribute(
      'title',
      'Content panel'
    );
    expect(screen.getByTestId('link')).toHaveAttribute(
      'aria-label',
      'Products link'
    );
    expect(screen.getByTestId('link')).toHaveAttribute('title', 'Products');
    expect(screen.getByTestId('link')).toHaveTextContent('Products');
    expect(screen.getByTestId('link').textContent).not.toContain('Hidden');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[36mKeep\u0000 raw'
    );
  });

  it('sanitizes viewport and indicator accessibility labels', () => {
    render(
      <>
        <NavigationMenuViewport
          aria-label={'\u001b]0;Hidden viewport\u0007\u001b[31mViewport\u0000'}
          title={'\u001b]0;Hidden viewport title\u0007\u001b[32mMenu viewport\u0007'}
        />
        <NavigationMenuIndicator
          aria-label={'\u001b]0;Hidden indicator\u0007\u001b[33mIndicator\u0000'}
          title={'\u001b]0;Hidden indicator title\u0007\u001b[34mMenu indicator\u0007'}
        />
      </>
    );

    expect(screen.getByTestId('viewport')).toHaveAttribute(
      'aria-label',
      'Viewport'
    );
    expect(screen.getByTestId('viewport')).toHaveAttribute(
      'title',
      'Menu viewport'
    );
    expect(screen.getByTestId('indicator')).toHaveAttribute(
      'aria-label',
      'Indicator'
    );
    expect(screen.getByTestId('indicator')).toHaveAttribute(
      'title',
      'Menu indicator'
    );
  });
});
