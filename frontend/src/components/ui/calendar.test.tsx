import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-day-picker', async () => {

  type DayPickerProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    classNames?: Record<string, string>;
    components?: {
      IconLeft?: ReactTypes.ComponentType;
      IconRight?: ReactTypes.ComponentType;
    };
    footer?: ReactTypes.ReactNode;
    showOutsideDays?: boolean;
  };

  const DayPicker = ({
    className,
    classNames,
    components,
    footer,
    showOutsideDays,
    ...props
  }: DayPickerProps) => {
    const IconLeft = components?.IconLeft;
    const IconRight = components?.IconRight;

    return (
      <div
        className={className}
        data-caption-class={classNames?.caption}
        data-day-class={classNames?.day}
        data-show-outside-days={String(showOutsideDays)}
        data-testid='day-picker'
        {...props}
      >
        <div data-testid='footer'>{footer}</div>
        {IconLeft ? <IconLeft /> : null}
        {IconRight ? <IconRight /> : null}
      </div>
    );
  };

  return { DayPicker };
});

import { Calendar } from './calendar';

describe('Calendar text boundaries', () => {
  it('sanitizes accessibility text and string footer while preserving calendar props', () => {
    render(
      <Calendar
        className='custom-calendar'
        classNames={{ day: 'custom-day' }}
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mBooking\u0000 calendar'}
        footer={'\u001b]0;Hidden footer\u0007\u001b[32mSelect a date\u0007'}
        title={'\u001b]0;Hidden title\u0007\u001b[33mCalendar\u0000'}
      />
    );

    const calendar = screen.getByTestId('day-picker');

    expect(calendar).toHaveAttribute('aria-label', 'Booking calendar');
    expect(calendar).toHaveAttribute('title', 'Calendar');
    expect(calendar).toHaveAttribute('data-show-outside-days', 'true');
    expect(calendar).toHaveAttribute('data-day-class', 'custom-day');
    expect(calendar.className).toContain('p-3');
    expect(calendar.className).toContain('custom-calendar');
    expect(screen.getByTestId('footer')).toHaveTextContent('Select a date');
    expect(screen.getByTestId('footer').textContent).not.toContain('\u001b');
    expect(screen.getByTestId('footer').textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized accessibility text and preserves explicit showOutsideDays', () => {
    render(
      <Calendar
        showOutsideDays={false}
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      />
    );

    const calendar = screen.getByTestId('day-picker');

    expect(calendar).not.toHaveAttribute('aria-label');
    expect(calendar).not.toHaveAttribute('title');
    expect(calendar).toHaveAttribute('data-show-outside-days', 'false');
  });

  it('preserves rich footer nodes and renders navigation icons', () => {
    render(
      <Calendar
        footer={
          <span data-testid='rich-footer'>{'\u001b[33mKeep\u0000 raw'}</span>
        }
      />
    );

    expect(screen.getByTestId('rich-footer').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
    expect(screen.getByTestId('day-picker').querySelectorAll('svg')).toHaveLength(
      2
    );
  });
});
