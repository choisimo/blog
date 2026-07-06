import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-progress', async () => {
  const React = await import('react');

  type RootProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    value?: number | null;
  };

  const Root = React.forwardRef<HTMLDivElement, RootProps>(
    ({ children, value, ...props }, ref) => (
      <div
        ref={ref}
        role='progressbar'
        aria-valuenow={value ?? undefined}
        data-value={value ?? undefined}
        data-testid='root'
        {...props}
      >
        {children}
      </div>
    )
  );
  Root.displayName = 'Root';

  const Indicator = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >((props, ref) => <div ref={ref} data-testid='indicator' {...props} />);
  Indicator.displayName = 'Indicator';

  return {
    Root,
    Indicator,
  };
});

import { Progress } from './progress';

describe('Progress accessibility text boundaries', () => {
  it('sanitizes accessibility text while preserving value and indicator transform', () => {
    render(
      <Progress
        value={42}
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mUpload\u0000 progress'}
        aria-valuetext={'\u001b]0;Hidden value\u0007\u001b[32m42 percent\u0007 complete'}
        title={'\u001b]0;Hidden title\u0007\u001b[33mUpload\u0000'}
      />
    );

    const progress = screen.getByRole('progressbar', {
      name: 'Upload progress',
    });

    expect(progress).toHaveAttribute('aria-valuenow', '42');
    expect(progress).toHaveAttribute('aria-valuetext', '42 percent complete');
    expect(progress).toHaveAttribute('data-value', '42');
    expect(progress).toHaveAttribute('title', 'Upload');
    expect(progress.getAttribute('aria-label')).not.toContain('Hidden');
    expect(progress.getAttribute('aria-valuetext')).not.toContain('Hidden');
    expect(progress.getAttribute('title')).not.toContain('Hidden');
    expect(screen.getByTestId('indicator')).toHaveStyle({
      transform: 'translateX(-58%)',
    });
  });

  it('omits empty sanitized accessibility text without changing zero value', () => {
    render(
      <Progress
        value={0}
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        aria-valuetext={'\u0007'}
        title={'\u0008'}
      />
    );

    const progress = screen.getByTestId('root');

    expect(progress).not.toHaveAttribute('aria-label');
    expect(progress).not.toHaveAttribute('aria-valuetext');
    expect(progress).not.toHaveAttribute('title');
    expect(progress).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByTestId('indicator')).toHaveStyle({
      transform: 'translateX(-100%)',
    });
  });
});
