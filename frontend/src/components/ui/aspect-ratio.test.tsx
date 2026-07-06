import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-aspect-ratio', async () => {
  const React = await import('react');

  type RootProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    ratio?: number;
  };

  const Root = React.forwardRef<HTMLDivElement, RootProps>(
    ({ children, ratio, ...props }, ref) => (
      <div ref={ref} data-ratio={ratio} data-testid='root' {...props}>
        {children}
      </div>
    )
  );
  Root.displayName = 'Root';

  return {
    Root,
  };
});

import { AspectRatio } from './aspect-ratio';

describe('AspectRatio text boundaries', () => {
  it('sanitizes text/accessibility attributes while preserving ratio', () => {
    render(
      <AspectRatio
        ratio={16 / 9}
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mHero\u0000 media'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mHero\u0007'}
      >
        {'\u001b]0;Hidden child\u0007\u001b[33mMedia placeholder\u0000'}
      </AspectRatio>
    );

    expect(screen.getByTestId('root')).toHaveAttribute(
      'aria-label',
      'Hero media'
    );
    expect(screen.getByTestId('root')).toHaveAttribute('title', 'Hero');
    expect(screen.getByTestId('root')).toHaveAttribute(
      'data-ratio',
      String(16 / 9)
    );
    expect(screen.getByTestId('root')).toHaveTextContent('Media placeholder');
    expect(screen.getByTestId('root').textContent).not.toContain('\u001b');
    expect(screen.getByTestId('root').textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized accessibility text and preserves rich child nodes', () => {
    render(
      <AspectRatio
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      >
        <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
      </AspectRatio>
    );

    expect(screen.getByTestId('root')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('root')).not.toHaveAttribute('title');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
