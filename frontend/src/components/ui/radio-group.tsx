import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeRadioGroupText = (value: string | number): string =>
  String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();

const sanitizeRadioGroupOptionalText = (
  value: unknown
): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeRadioGroupText(value);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeRadioGroupNode = (
  children: React.ReactNode
): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeRadioGroupText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeRadioGroupNode);
  }

  return children;
};

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn('grid gap-2', className)}
      aria-label={sanitizeRadioGroupOptionalText(ariaLabel)}
      title={sanitizeRadioGroupOptionalText(title)}
      {...props}
      ref={ref}
    >
      {sanitizeRadioGroupNode(children)}
    </RadioGroupPrimitive.Root>
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(
  ({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      aria-label={sanitizeRadioGroupOptionalText(ariaLabel)}
      title={sanitizeRadioGroupOptionalText(title)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className='flex items-center justify-center'>
        <Circle className='h-2.5 w-2.5 fill-current text-current' />
      </RadioGroupPrimitive.Indicator>
      {sanitizeRadioGroupNode(children)}
    </RadioGroupPrimitive.Item>
  );
  }
);
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
