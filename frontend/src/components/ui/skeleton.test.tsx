import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './skeleton';

describe('Skeleton text boundaries', () => {
  it('sanitizes accessibility attributes and direct text children', () => {
    render(
      <Skeleton
        data-testid='skeleton'
        className='h-4'
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mLoading\u0000 profile'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mLoading\u0007'}
      >
        {'\u001b]0;Hidden child\u0007\u001b[33mLoading placeholder\u0000'}
      </Skeleton>
    );

    const skeleton = screen.getByTestId('skeleton');

    expect(skeleton).toHaveAttribute('aria-label', 'Loading profile');
    expect(skeleton).toHaveAttribute('title', 'Loading');
    expect(skeleton).toHaveTextContent('Loading placeholder');
    expect(skeleton.textContent).not.toContain('\u001b');
    expect(skeleton.textContent).not.toContain('Hidden');
    expect(skeleton.className).toContain('animate-pulse');
    expect(skeleton.className).toContain('h-4');
  });

  it('omits empty sanitized accessibility text', () => {
    render(
      <Skeleton
        data-testid='skeleton'
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      />
    );

    const skeleton = screen.getByTestId('skeleton');

    expect(skeleton).not.toHaveAttribute('aria-label');
    expect(skeleton).not.toHaveAttribute('title');
    expect(skeleton.textContent).not.toContain('Hidden');
  });

  it('preserves rich child nodes', () => {
    render(
      <Skeleton data-testid='skeleton'>
        <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
      </Skeleton>
    );

    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
