import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('input-otp', async () => {
  const React = await import('react');

  const OTPInputContext = React.createContext({
    slots: [
      {
        char: '\u001b]0;Hidden slot one\u0007\u001b[31m1\u0000',
        hasFakeCaret: true,
        isActive: true,
      },
      {
        char: '\u001b]0;Hidden slot two\u0007\u001b[32m2\u0007',
        hasFakeCaret: false,
        isActive: false,
      },
    ],
  });

  type OTPInputProps = ReactTypes.InputHTMLAttributes<HTMLInputElement> & {
    containerClassName?: string;
  };

  const OTPInput = React.forwardRef<HTMLInputElement, OTPInputProps>(
    ({ children, className, containerClassName, ...props }, ref) => (
      <div className={containerClassName} data-testid='container'>
        <input ref={ref} className={className} data-testid='input' {...props} />
        {children}
      </div>
    )
  );
  OTPInput.displayName = 'OTPInput';

  return {
    OTPInput,
    OTPInputContext,
  };
});

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from './input-otp';

describe('InputOTP text boundaries', () => {
  it('sanitizes root accessibility text while preserving input props and classes', () => {
    const { container } = render(
      <InputOTP
        value='12'
        maxLength={6}
        className='otp-input'
        containerClassName='otp-container'
        aria-label={'\u001b]0;Hidden input\u0007\u001b[31mOne time\u0000 code'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mOTP\u0007'}
      >
        {'\u001b]0;Hidden helper\u0007\u001b[33mHelper\u0000'}
      </InputOTP>
    );

    const input = screen.getByTestId('input');

    expect(input).toHaveAttribute('aria-label', 'One time code');
    expect(input).toHaveAttribute('title', 'OTP');
    expect(input).toHaveAttribute('value', '12');
    expect(input).toHaveAttribute('maxlength', '6');
    expect(input.className).toContain('otp-input');
    expect(screen.getByTestId('container').className).toContain(
      'otp-container'
    );
    expect(screen.getByText('Helper')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
  });

  it('sanitizes group, slot, and separator text/accessibility while preserving slot state classes', () => {
    render(
      <InputOTPGroup
        aria-label={'\u001b]0;Hidden group\u0007\u001b[31mCode\u0000 group'}
        title={'\u001b]0;Hidden group title\u0007\u001b[32mGroup\u0007'}
      >
        <InputOTPSlot
          index={0}
          aria-label={'\u001b]0;Hidden slot\u0007\u001b[33mDigit\u0000 one'}
          title={'\u001b]0;Hidden slot title\u0007\u001b[34mDigit\u0007'}
        />
        <InputOTPSeparator
          aria-label={'\u001b]0;Hidden separator\u0007\u001b[35mSeparator\u0000'}
          title={'\u001b]0;Hidden dash\u0007\u001b[36mDash\u0007'}
        >
          {'\u001b]0;Hidden separator text\u0007\u001b[31m-\u0000'}
        </InputOTPSeparator>
      </InputOTPGroup>
    );

    expect(screen.getByLabelText('Code group')).toHaveAttribute(
      'title',
      'Group'
    );
    expect(screen.getByLabelText('Digit one')).toHaveAttribute('title', 'Digit');
    expect(screen.getByLabelText('Digit one')).toHaveTextContent('1');
    expect(screen.getByLabelText('Digit one').textContent).not.toContain(
      '\u001b'
    );
    expect(screen.getByLabelText('Digit one').textContent).not.toContain(
      'Hidden'
    );
    expect(screen.getByLabelText('Digit one').className).toContain('ring-2');
    expect(screen.getByRole('separator', { name: 'Separator' })).toHaveAttribute(
      'title',
      'Dash'
    );
    expect(screen.getByRole('separator', { name: 'Separator' })).toHaveTextContent(
      '-'
    );
    expect(
      screen.getByRole('separator', { name: 'Separator' }).textContent
    ).not.toContain('Hidden');
  });

  it('omits empty sanitized accessibility text and preserves rich children', () => {
    render(
      <InputOTPGroup
        aria-label={'\u001b]0;Hidden group\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      >
        <InputOTPSlot index={1}>
          <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
        </InputOTPSlot>
      </InputOTPGroup>
    );

    const group = screen.getByText('2').parentElement;

    expect(group?.parentElement).not.toHaveAttribute('aria-label');
    expect(group?.parentElement).not.toHaveAttribute('title');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
