import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async () => {

  const ResponsiveContainer = ({
    children,
  }: {
    children?: ReactTypes.ReactNode;
  }) => <div data-testid='responsive-container'>{children}</div>;

  const Tooltip = () => null;
  const Legend = () => null;

  return {
    Legend,
    ResponsiveContainer,
    Tooltip,
  };
});

import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  type ChartConfig,
} from './chart';

describe('Chart text boundaries', () => {
  const config: ChartConfig = {
    revenue: {
      color: '#0f0',
      label: '\u001b]0;Hidden revenue\u0007\u001b[31mRevenue\u0000',
    },
    cost: {
      label: '\u001b]2;Hidden cost\u001b\\\u001b[32mCost\u0007',
    },
  };

  it('sanitizes container accessibility text and direct string children', () => {
    render(
      <ChartContainer
        config={config}
        aria-label={'\u001b]0;Hidden container\u0007\u001b[31mRevenue\u0000 chart'}
        title={'\u001b]2;Hidden title\u001b\\\u001b[32mChart\u0007'}
      >
        {'\u001b]0;Hidden body\u0007\u001b[33mChart body\u0000'}
      </ChartContainer>
    );

    const chart = screen.getByLabelText('Revenue chart');

    expect(chart).toHaveAttribute('title', 'Chart');
    expect(screen.getByTestId('responsive-container')).toHaveTextContent(
      'Chart body'
    );
    expect(screen.getByTestId('responsive-container').textContent).not.toContain(
      '\u001b'
    );
    expect(screen.getByTestId('responsive-container').textContent).not.toContain(
      'Hidden'
    );
  });

  it('sanitizes tooltip labels and values while preserving payload names', () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          aria-label={'\u001b]0;Hidden tooltip\u0007\u001b[31mTooltip\u0000'}
          label={'\u001b]0;Hidden label\u0007\u001b[32mRevenue\u0007'}
          payload={[
            {
              color: '#0f0',
              dataKey: 'revenue',
              name: 'revenue',
              payload: {},
              value: '\u001b]2;Hidden value\u001b\\\u001b[33m1200\u0000',
            },
          ]}
          title={'\u001b]0;Hidden tooltip title\u0007\u001b[34mTooltip title\u0007'}
        />
      </ChartContainer>
    );

    const tooltip = screen.getByLabelText('Tooltip');

    expect(tooltip).toHaveAttribute('title', 'Tooltip title');
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('1200')).toBeInTheDocument();
    expect(tooltip.textContent).not.toContain('\u001b');
    expect(tooltip.textContent).not.toContain('Hidden');
  });

  it('sanitizes legend labels and accessibility text while preserving colors', () => {
    render(
      <ChartContainer config={config}>
        <ChartLegendContent
          aria-label={'\u001b]0;Hidden legend\u0007\u001b[31mLegend\u0000'}
          payload={[
            {
              color: '#f00',
              dataKey: 'cost',
              value: 'cost',
            },
          ]}
          title={'\u001b]0;Hidden legend title\u0007\u001b[32mLegend title\u0007'}
        />
      </ChartContainer>
    );

    const legend = screen.getByLabelText('Legend');

    expect(legend).toHaveAttribute('title', 'Legend title');
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(legend.textContent).not.toContain('\u001b');
    expect(legend.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized accessibility text and preserves rich config labels', () => {
    const RichLabel = () => (
      <span data-testid='rich-label'>{'\u001b[33mKeep\u0000 raw'}</span>
    );

    render(
      <ChartContainer
        config={{ rich: { label: <RichLabel /> } }}
        aria-label={'\u001b]0;Hidden empty label\u0007\u001b[31m\u0000'}
        title={'\u001b]0;Hidden empty title\u0007\u0007'}
      >
        <ChartLegendContent
          payload={[
            {
              color: '#00f',
              dataKey: 'rich',
              value: 'rich',
            },
          ]}
        />
      </ChartContainer>
    );

    expect(screen.getByTestId('responsive-container').parentElement).not.toHaveAttribute(
      'aria-label'
    );
    expect(screen.getByTestId('responsive-container').parentElement).not.toHaveAttribute(
      'title'
    );
    expect(screen.getByTestId('rich-label').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
