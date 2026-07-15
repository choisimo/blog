import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { Dot } from 'lucide-react';

import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeInputOTPText = (value: string | number): string =>
  String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();

const sanitizeInputOTPOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeInputOTPText(value);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeInputOTPNode = (
  children: React.ReactNode
): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeInputOTPText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeInputOTPNode);
  }

  return children;
};

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(
  (
    { className, containerClassName, 'aria-label': ariaLabel, title, ...props },
    ref
  ) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      'flex items-center gap-2 has-[:disabled]:opacity-50',
      containerClassName
    )}
    className={cn('disabled:cursor-not-allowed', className)}
    aria-label={sanitizeInputOTPOptionalText(ariaLabel)}
    title={sanitizeInputOTPOptionalText(title)}
    {...props}
  />
  )
);
InputOTP.displayName = 'InputOTP';

const InputOTPGroup = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center', className)}
    aria-label={sanitizeInputOTPOptionalText(ariaLabel)}
    title={sanitizeInputOTPOptionalText(title)}
    {...props}
  >
    {sanitizeInputOTPNode(children)}
  </div>
));
InputOTPGroup.displayName = 'InputOTPGroup';

const InputOTPSlot = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & { index: number }
>(({ index, className, children, 'aria-label': ariaLabel, title, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md',
        isActive && 'z-10 ring-2 ring-ring ring-offset-background',
        className
      )}
      aria-label={sanitizeInputOTPOptionalText(ariaLabel)}
      title={sanitizeInputOTPOptionalText(title)}
      {...props}
    >
      {sanitizeInputOTPNode(char)}
      {sanitizeInputOTPNode(children)}
      {hasFakeCaret && (
        <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
          <div className='h-4 w-px animate-caret-blink bg-foreground duration-1000' />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = 'InputOTPSlot';

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <div
    ref={ref}
    role='separator'
    aria-label={sanitizeInputOTPOptionalText(ariaLabel)}
    title={sanitizeInputOTPOptionalText(title)}
    {...props}
  >
    {sanitizeInputOTPNode(children)}
    <Dot />
  </div>
));
InputOTPSeparator.displayName = 'InputOTPSeparator';

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
