import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-scroll-area', async () => {
  const React = await import('react');

  const Root = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='root' {...props}>
      {children}
    </div>
  ));
  Root.displayName = 'Root';

  const Viewport = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='viewport' {...props}>
      {children}
    </div>
  ));
  Viewport.displayName = 'Viewport';

  type ScrollbarProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    orientation?: 'horizontal' | 'vertical';
  };

  const ScrollAreaScrollbar = React.forwardRef<HTMLDivElement, ScrollbarProps>(
    ({ children, orientation, ...props }, ref) => (
      <div
        ref={ref}
        data-orientation={orientation}
        data-testid='scrollbar'
        {...props}
      >
        {children}
      </div>
    )
  );
  ScrollAreaScrollbar.displayName = 'ScrollAreaScrollbar';

  const ScrollAreaThumb = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >((props, ref) => <div ref={ref} data-testid='thumb' {...props} />);
  ScrollAreaThumb.displayName = 'ScrollAreaThumb';

  const Corner = (props: ReactTypes.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid='corner' {...props} />
  );
  Corner.displayName = 'Corner';

  return {
    Root,
    Viewport,
    ScrollAreaScrollbar,
    ScrollAreaThumb,
    Corner,
  };
});

import { ScrollArea, ScrollBar } from './scroll-area';

describe('ScrollArea text boundaries', () => {
  it('sanitizes root text/accessibility attributes and preserves scroll parts', () => {
    render(
      <ScrollArea
        aria-label={'\u001b]0;Hidden root\u0007\u001b[31mArticle\u0000 content'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mScrollable\u0007 region'}
      >
        {'\u001b]0;Hidden child\u0007\u001b[33mScrollable text\u0000'}
      </ScrollArea>
    );

    expect(screen.getByTestId('root')).toHaveAttribute(
      'aria-label',
      'Article content'
    );
    expect(screen.getByTestId('root')).toHaveAttribute(
      'title',
      'Scrollable region'
    );
    expect(screen.getByTestId('viewport')).toHaveTextContent(
      'Scrollable text'
    );
    expect(screen.getByTestId('viewport').textContent).not.toContain('\u001b');
    expect(screen.getByTestId('viewport').textContent).not.toContain('Hidden');
    expect(screen.getByTestId('scrollbar')).toHaveAttribute(
      'data-orientation',
      'vertical'
    );
    expect(screen.getByTestId('thumb')).toBeInTheDocument();
    expect(screen.getByTestId('corner')).toBeInTheDocument();
  });

  it('sanitizes scrollbar labels while preserving orientation classes', () => {
    render(
      <ScrollBar
        orientation='horizontal'
        aria-label={'\u001b]0;Hidden scrollbar\u0007\u001b[31mHorizontal\u0000 scroll'}
        title={'\u001b]0;Hidden scrollbar title\u0007\u001b[32mScrollbar\u0007'}
      />
    );

    const scrollbar = screen.getByTestId('scrollbar');

    expect(scrollbar).toHaveAttribute('aria-label', 'Horizontal scroll');
    expect(scrollbar).toHaveAttribute('title', 'Scrollbar');
    expect(scrollbar.getAttribute('aria-label')).not.toContain('Hidden');
    expect(scrollbar.getAttribute('title')).not.toContain('Hidden');
    expect(scrollbar).toHaveAttribute('data-orientation', 'horizontal');
    expect(scrollbar.className).toContain('h-2.5');
    expect(scrollbar.className).toContain('flex-col');
    expect(screen.getByTestId('thumb')).toBeInTheDocument();
  });

  it('omits empty sanitized accessibility text and preserves rich children', () => {
    render(
      <ScrollArea
        aria-label={'\u001b]0;Hidden root\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      >
        <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
      </ScrollArea>
    );

    expect(screen.getByTestId('root')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('root')).not.toHaveAttribute('title');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
