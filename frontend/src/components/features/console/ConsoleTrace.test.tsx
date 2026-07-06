import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConsoleTrace } from './ConsoleTrace';

describe('ConsoleTrace', () => {
  it('sanitizes region, summary, and expanded trace text boundaries', () => {
    const { container } = render(
      <ConsoleTrace
        label={'\u001B]0;Hidden region\u0007\u001b[31mTrace region\u0000'}
        title={'\u001B]0;Hidden title\u0007Trace\u0007 title'}
        summaryLabel={'\u001B]0;Hidden summary\u0007\u001b[32mPipeline\u0008'}
        toggleLabel={'\u001B]0;Hidden toggle\u0007Show\u0009 trace'}
        className='custom-trace'
        traces={[
          {
            id: 'trace-1',
            type: 'search',
            label: '\u001B]0;Hidden label\u0007\u001b[33mHybrid search\u000a',
            detail: '\u001B]0;Hidden detail\u0007Query\u000b detail',
            timestamp: 1,
            status: 'done',
            duration: 12.6,
          },
        ]}
      />
    );

    const region = screen.getByRole('region', { name: 'Trace region' });
    const toggle = screen.getByRole('button', { name: 'Show trace' });

    expect(region).toHaveAttribute('title', 'Trace title');
    expect(region).toHaveClass('custom-trace');
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Hybrid search')).toBeInTheDocument();
    expect(screen.getByText('Query detail')).toBeInTheDocument();
    expect(screen.getByText('13ms')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u000a');
  });

  it('preserves summary counts, duration totals, and status fallback rendering', () => {
    render(
      <ConsoleTrace
        traces={[
          {
            id: 'running',
            type: 'retrieve',
            label: 'Retrieve',
            timestamp: 1,
            status: 'running',
            duration: 5,
          },
          {
            id: 'error',
            type: 'error',
            label: 'Error step',
            timestamp: 2,
            status: 'error',
            duration: 10,
          },
          {
            id: 'fallback',
            type: 'unknown' as never,
            label: '\u001b[31m\u0000',
            timestamp: 3,
            status: 'unknown' as never,
            duration: -1,
          },
        ]}
      />
    );

    expect(screen.getByText('1', { selector: '.text-amber-400' })).toBeInTheDocument();
    expect(screen.getByText('1', { selector: '.text-red-400' })).toBeInTheDocument();
    expect(screen.getByText('15ms')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle trace details' }));

    expect(screen.getByText('Trace step')).toBeInTheDocument();
  });

  it('renders nothing when no traces are present', () => {
    const { container } = render(<ConsoleTrace traces={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
