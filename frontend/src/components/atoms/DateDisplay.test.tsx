import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DateDisplay, ReadTime } from './DateDisplay';

describe('DateDisplay', () => {
  it('sanitizes control and ANSI text from date labels', () => {
    render(
      <DateDisplay
        date={'\u001b]0;Hidden date\u0007\u001b[31m2026-07-05\u001b[0m\u0000'}
        showIcon={false}
        label={'\u001b]0;Hidden label\u0007\u001b[32mPublished date\u0007'}
        title={'\u001b]0;Hidden title\u0007Date\u0008 title'}
        className='custom-date'
      />
    );

    const display = screen.getByText('2026-07-05');

    expect(display).toHaveAttribute('aria-label', 'Published date');
    expect(display).toHaveAttribute('title', 'Date title');
    expect(display).toHaveClass('custom-date');
    expect(display.textContent).not.toContain('Hidden');
    expect(display.textContent).not.toContain('\u001b');
  });

  it('normalizes invalid and fractional reading times before rendering', () => {
    const { rerender } = render(<ReadTime readTime={Number.NaN} showIcon={false} />);

    expect(screen.getByText('0 min read')).toBeInTheDocument();

    rerender(<ReadTime readTime={3.6} showIcon={false} />);

    expect(screen.getByText('4 min read')).toBeInTheDocument();
  });

  it('sanitizes read time accessibility attributes and hides decorative icons', () => {
    const { container } = render(
      <ReadTime
        readTime={5}
        label={'\u001b]0;Hidden label\u0007\u001b[33mReading time\u0000'}
        title={'\u001b]0;Hidden title\u0007Read\u0007 title'}
        className='custom-read-time'
      />
    );

    const display = screen.getByText('5 min read');

    expect(display).toHaveAttribute('aria-label', 'Reading time');
    expect(display).toHaveAttribute('title', 'Read title');
    expect(display).toHaveClass('custom-read-time');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('omits empty sanitized accessibility attributes', () => {
    render(
      <DateDisplay
        date='2026-07-05'
        label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      />
    );

    const display = screen.getByText('2026-07-05');

    expect(display).not.toHaveAttribute('aria-label');
    expect(display).not.toHaveAttribute('title');
  });
});
