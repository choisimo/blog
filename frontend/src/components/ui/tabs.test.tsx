import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-tabs', async () => {
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
        data-value={value}
        data-testid='root'
        {...props}
      >
        {children}
      </div>
    )
  );
  Root.displayName = 'Root';

  const List = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} role='tablist' data-testid='list' {...props}>
      {children}
    </div>
  ));
  List.displayName = 'List';

  type TriggerProps = ReactTypes.ButtonHTMLAttributes<HTMLButtonElement> & {
    value?: string;
  };

  const Trigger = React.forwardRef<HTMLButtonElement, TriggerProps>(
    ({ children, value, ...props }, ref) => (
      <button
        ref={ref}
        role='tab'
        data-value={value}
        data-testid='trigger'
        type='button'
        {...props}
      >
        {children}
      </button>
    )
  );
  Trigger.displayName = 'Trigger';

  type ContentProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    value?: string;
  };

  const Content = React.forwardRef<HTMLDivElement, ContentProps>(
    ({ children, value, ...props }, ref) => (
      <div ref={ref} role='tabpanel' data-value={value} data-testid='content' {...props}>
        {children}
      </div>
    )
  );
  Content.displayName = 'Content';

  return {
    Root,
    List,
    Trigger,
    Content,
  };
});

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

describe('Tabs text boundaries', () => {
  it('sanitizes root, list, and trigger text/accessibility attributes while preserving values', () => {
    render(
      <Tabs
        defaultValue='overview'
        aria-label={'\u001b]0;Hidden root\u0007\u001b[31mProfile\u0000 tabs'}
        title={'\u001b]0;Hidden root title\u0007\u001b[32mProfile\u0007'}
      >
        <TabsList
          variant='terminal'
          aria-label={'\u001b]0;Hidden list\u0007\u001b[33mSections\u0000'}
          title={'\u001b]0;Hidden list title\u0007\u001b[34mSection tabs\u0007'}
        >
          <TabsTrigger
            value='overview'
            variant='terminal'
            aria-label={'\u001b]0;Hidden trigger\u0007\u001b[35mOverview tab\u0000'}
            title={'\u001b]0;Hidden trigger title\u0007\u001b[36mOverview\u0007'}
          >
            {'\u001b]0;Hidden trigger text\u0007\u001b[31mOverview\u0000'}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(screen.getByTestId('root')).toHaveAttribute(
      'aria-label',
      'Profile tabs'
    );
    expect(screen.getByTestId('root')).toHaveAttribute('title', 'Profile');
    expect(screen.getByTestId('root')).toHaveAttribute(
      'data-default-value',
      'overview'
    );
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-label',
      'Sections'
    );
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'title',
      'Section tabs'
    );

    const trigger = screen.getByRole('tab', { name: 'Overview tab' });

    expect(trigger).toHaveAttribute('title', 'Overview');
    expect(trigger).toHaveAttribute('data-value', 'overview');
    expect(trigger).toHaveTextContent('Overview');
    expect(trigger.textContent).not.toContain('\u001b');
    expect(trigger.textContent).not.toContain('Hidden');
    expect(trigger.className).toContain('font-mono');
  });

  it('sanitizes content text/accessibility attributes', () => {
    render(
      <TabsContent
        value='details'
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31mDetails\u0000 panel'}
        title={'\u001b]0;Hidden content title\u0007\u001b[32mDetails\u0007'}
      >
        {'\u001b]0;Hidden content text\u0007\u001b[33mDetails text\u0000'}
      </TabsContent>
    );

    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-label',
      'Details panel'
    );
    expect(screen.getByRole('tabpanel')).toHaveAttribute('title', 'Details');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('data-value', 'details');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Details text');
    expect(screen.getByRole('tabpanel').textContent).not.toContain('\u001b');
    expect(screen.getByRole('tabpanel').textContent).not.toContain('Hidden');
  });

  it('preserves rich child nodes and omits empty sanitized accessibility text', () => {
    render(
      <Tabs
        aria-label={'\u001b]0;Hidden root\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      >
        <TabsList
          aria-label={'\u001b]0;Hidden list\u0007\u001b[32m\u0000'}
          title={'\u0008'}
        >
          <TabsTrigger value='rich'>
            <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(screen.getByTestId('root')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('root')).not.toHaveAttribute('title');
    expect(screen.getByRole('tablist')).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('tablist')).not.toHaveAttribute('title');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
