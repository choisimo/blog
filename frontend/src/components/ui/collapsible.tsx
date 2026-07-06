import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeCollapsibleText = (value: string | number): string =>
  String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();

const sanitizeCollapsibleOptionalText = (
  value: unknown
): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeCollapsibleText(value);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeCollapsibleNode = (
  children: React.ReactNode
): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeCollapsibleText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeCollapsibleNode);
  }

  return children;
};

const Collapsible = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root>
>(({ children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <CollapsiblePrimitive.Root
    ref={ref}
    aria-label={sanitizeCollapsibleOptionalText(ariaLabel)}
    title={sanitizeCollapsibleOptionalText(title)}
    {...props}
  >
    {sanitizeCollapsibleNode(children)}
  </CollapsiblePrimitive.Root>
));
Collapsible.displayName = CollapsiblePrimitive.Root.displayName;

const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleTrigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleTrigger>
>(({ children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleTrigger
    ref={ref}
    aria-label={sanitizeCollapsibleOptionalText(ariaLabel)}
    title={sanitizeCollapsibleOptionalText(title)}
    {...props}
  >
    {sanitizeCollapsibleNode(children)}
  </CollapsiblePrimitive.CollapsibleTrigger>
));
CollapsibleTrigger.displayName =
  CollapsiblePrimitive.CollapsibleTrigger.displayName;

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleContent
    ref={ref}
    aria-label={sanitizeCollapsibleOptionalText(ariaLabel)}
    title={sanitizeCollapsibleOptionalText(title)}
    {...props}
  >
    {sanitizeCollapsibleNode(children)}
  </CollapsiblePrimitive.CollapsibleContent>
));
CollapsibleContent.displayName =
  CollapsiblePrimitive.CollapsibleContent.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
