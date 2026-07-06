import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-slider', async () => {
  const React = await import('react');

  type RootProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    defaultValue?: number[];
    max?: number;
    min?: number;
    step?: number;
    value?: number[];
  };

  const Root = React.forwardRef<HTMLDivElement, RootProps>(
    (
      { children, defaultValue, max, min, step, value, ...props },
      ref
    ) => (
      <div
        ref={ref}
        role='slider'
        aria-valuenow={value?.[0] ?? defaultValue?.[0]}
        data-default-value={defaultValue?.join(',')}
        data-max={max}
        data-min={min}
        data-step={step}
        data-value={value?.join(',')}
        data-testid='root'
        {...props}
      >
        {children}
      </div>
    )
  );
  Root.displayName = 'Root';

  const Track = ({
    children,
    ...props
  }: ReactTypes.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid='track' {...props}>
      {children}
    </div>
  );
  Track.displayName = 'Track';

  const Range = (props: ReactTypes.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid='range' {...props} />
  );
  Range.displayName = 'Range';

  const Thumb = (props: ReactTypes.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid='thumb' {...props} />
  );
  Thumb.displayName = 'Thumb';

  return {
    Root,
    Track,
    Range,
    Thumb,
  };
});

import { Slider } from './slider';

describe('Slider accessibility text boundaries', () => {
  it('sanitizes accessibility text while preserving numeric slider props', () => {
    render(
      <Slider
        value={[42]}
        min={0}
        max={100}
        step={2}
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mVolume\u0000 control'}
        aria-valuetext={'\u001b]0;Hidden value\u0007\u001b[32m42 percent\u0007'}
        title={'\u001b]0;Hidden title\u0007\u001b[33mVolume\u0000'}
      />
    );

    const slider = screen.getByRole('slider', { name: 'Volume control' });

    expect(slider).toHaveAttribute('aria-valuenow', '42');
    expect(slider).toHaveAttribute('aria-valuetext', '42 percent');
    expect(slider).toHaveAttribute('data-value', '42');
    expect(slider).toHaveAttribute('data-min', '0');
    expect(slider).toHaveAttribute('data-max', '100');
    expect(slider).toHaveAttribute('data-step', '2');
    expect(slider).toHaveAttribute('title', 'Volume');
    expect(slider.getAttribute('aria-label')).not.toContain('Hidden');
    expect(slider.getAttribute('aria-valuetext')).not.toContain('Hidden');
    expect(slider.getAttribute('title')).not.toContain('Hidden');
    expect(screen.getByTestId('track')).toBeInTheDocument();
    expect(screen.getByTestId('range')).toBeInTheDocument();
    expect(screen.getByTestId('thumb')).toBeInTheDocument();
  });

  it('omits empty sanitized accessibility text without changing default values', () => {
    render(
      <Slider
        defaultValue={[0]}
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        aria-valuetext={'\u0007'}
        title={'\u0008'}
      />
    );

    const slider = screen.getByTestId('root');

    expect(slider).not.toHaveAttribute('aria-label');
    expect(slider).not.toHaveAttribute('aria-valuetext');
    expect(slider).not.toHaveAttribute('title');
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    expect(slider).toHaveAttribute('data-default-value', '0');
  });
});
