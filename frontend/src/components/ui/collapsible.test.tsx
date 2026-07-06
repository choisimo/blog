import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-collapsible', async () => {
  const React = await import('react');

  type RootProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    defaultOpen?: boolean;
    open?: boolean;
  };

  const Root = React.forwardRef<HTMLDivElement, RootProps>(
    ({ children, defaultOpen, open, ...props }, ref) => (
      <div
        ref={ref}
        data-default-open={String(defaultOpen)}
        data-open={String(open)}
        data-testid='root'
        {...props}
      >
        {children}
      </div>
    )
  );
  Root.displayName = 'Root';

  const CollapsibleTrigger = React.forwardRef<
    HTMLButtonElement,
    ReactTypes.ButtonHTMLAttributes<HTMLButtonElement>
  >(({ children, ...props }, ref) => (
    <button ref={ref} data-testid='trigger' type='button' {...props}>
      {children}
    </button>
  ));
  CollapsibleTrigger.displayName = 'CollapsibleTrigger';

  const CollapsibleContent = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='content' {...props}>
      {children}
    </div>
  ));
  CollapsibleContent.displayName = 'CollapsibleContent';

  return {
    Root,
    CollapsibleTrigger,
    CollapsibleContent,
  };
});

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible';

describe('Collapsible text boundaries', () => {
  it('sanitizes root and trigger text/accessibility attributes while preserving open state props', () => {
    render(
      <Collapsible
        defaultOpen
        aria-label={'\u001b]0;Hidden root\u0007\u001b[31mDetails\u0000 region'}
        title={'\u001b]0;Hidden details title\u0007\u001b[32mDetails\u0007'}
      >
        <CollapsibleTrigger
          aria-label={'\u001b]0;Hidden trigger\u0007\u001b[33mToggle details\u0000'}
          title={'\u001b]0;Hidden toggle title\u0007\u001b[34mToggle\u0007'}
        >
          {'\u001b]0;Hidden trigger text\u0007\u001b[35mShow details\u0000'}
        </CollapsibleTrigger>
      </Collapsible>
    );

    expect(screen.getByTestId('root')).toHaveAttribute(
      'aria-label',
      'Details region'
    );
    expect(screen.getByTestId('root')).toHaveAttribute('title', 'Details');
    expect(screen.getByTestId('root')).toHaveAttribute(
      'data-default-open',
      'true'
    );

    const trigger = screen.getByRole('button', { name: 'Toggle details' });

    expect(trigger).toHaveAttribute('title', 'Toggle');
    expect(trigger).toHaveTextContent('Show details');
    expect(trigger.textContent).not.toContain('\u001b');
    expect(trigger.textContent).not.toContain('Hidden');
  });

  it('sanitizes content text/accessibility attributes', () => {
    render(
      <CollapsibleContent
        aria-label={'\u001b]0;Hidden content label\u0007\u001b[31mExpanded\u0000 content'}
        title={'\u001b]0;Hidden content title\u0007\u001b[32mContent\u0007'}
      >
        {'\u001b]0;Hidden content text\u0007\u001b[33mVisible details\u0000'}
      </CollapsibleContent>
    );

    expect(screen.getByTestId('content')).toHaveAttribute(
      'aria-label',
      'Expanded content'
    );
    expect(screen.getByTestId('content')).toHaveAttribute('title', 'Content');
    expect(screen.getByTestId('content')).toHaveTextContent('Visible details');
    expect(screen.getByTestId('content').textContent).not.toContain('\u001b');
    expect(screen.getByTestId('content').textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized accessibility text and preserves rich child nodes', () => {
    render(
      <Collapsible
        aria-label={'\u001b]0;Hidden root\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      >
        <CollapsibleContent>
          <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
        </CollapsibleContent>
      </Collapsible>
    );

    expect(screen.getByTestId('root')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('root')).not.toHaveAttribute('title');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
