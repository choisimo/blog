import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeAccordionText = (value: string | number): string =>
  String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();

const sanitizeAccordionOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeAccordionText(value);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeAccordionNode = (
  children: React.ReactNode
): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeAccordionText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeAccordionNode);
  }

  return children;
};

const Accordion = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>
>(({ children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <AccordionPrimitive.Root
    ref={ref}
    aria-label={sanitizeAccordionOptionalText(ariaLabel)}
    title={sanitizeAccordionOptionalText(title)}
    {...props}
  >
    {sanitizeAccordionNode(children)}
  </AccordionPrimitive.Root>
));
Accordion.displayName = AccordionPrimitive.Root.displayName;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(
  ({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border-b border-border', className)}
    aria-label={sanitizeAccordionOptionalText(ariaLabel)}
    title={sanitizeAccordionOptionalText(title)}
    {...props}
  >
    {sanitizeAccordionNode(children)}
  </AccordionPrimitive.Item>
  )
);
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(
  ({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <AccordionPrimitive.Header className='flex'>
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex flex-1 items-center justify-between py-4 font-medium text-foreground transition-all hover:text-primary [&[data-state=open]>svg]:rotate-180',
        className
      )}
      aria-label={sanitizeAccordionOptionalText(ariaLabel)}
      title={sanitizeAccordionOptionalText(title)}
      {...props}
    >
      {sanitizeAccordionNode(children)}
      <ChevronDown className='h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200' />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
  )
);
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(
  ({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className='overflow-hidden text-sm text-muted-foreground transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down'
    aria-label={sanitizeAccordionOptionalText(ariaLabel)}
    title={sanitizeAccordionOptionalText(title)}
    {...props}
  >
    <div className={cn('pb-4 pt-0', className)}>
      {sanitizeAccordionNode(children)}
    </div>
  </AccordionPrimitive.Content>
  )
);

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
