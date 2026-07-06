import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConsoleTrace } from '@/components/features/console/ConsoleTrace';

describe('ConsoleTrace', () => {
  it('normalizes trace text, status counts, and durations before rendering', () => {
    render(
      <ConsoleTrace
        traces={[
          {
            id: 'invalid',
            type: 'unknown',
            status: 'waiting',
            label: ' Find\nDocs\u0000 ',
            detail: ' first line\r\nsecond line ',
            duration: Number.NaN,
          } as any,
          {
            id: 'running',
            type: 'search',
            status: 'running',
            label: 'Running',
            duration: 10.6,
          },
          {
            id: 'done',
            type: 'retrieve',
            status: 'done',
            label: 'Done',
            duration: 5.2,
          },
          {
            id: 'error',
            type: 'error',
            status: 'error',
            label: 'Error',
            duration: -1,
          },
        ]}
      />,
    );

    expect(screen.getByText('16ms')).toBeInTheDocument();
    expect(screen.queryByText('NaNms')).not.toBeInTheDocument();
    expect(screen.queryByText('-1ms')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Trace/i }));

    expect(screen.getByText('Find Docs')).toBeInTheDocument();
    expect(screen.getByText('first line second line')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});
