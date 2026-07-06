import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeAvatarText = (value: string | number): string =>
  String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();

const sanitizeAvatarOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeAvatarText(value);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeAvatarNode = (children: React.ReactNode): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeAvatarText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeAvatarNode);
  }

  return children;
};

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(
  ({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
      className
    )}
    aria-label={sanitizeAvatarOptionalText(ariaLabel)}
    title={sanitizeAvatarOptionalText(title)}
    {...props}
  >
    {sanitizeAvatarNode(children)}
  </AvatarPrimitive.Root>
  )
);
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(
  (
    { className, alt, 'aria-label': ariaLabel, title, ...props },
    ref
  ) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    alt={sanitizeAvatarOptionalText(alt)}
    aria-label={sanitizeAvatarOptionalText(ariaLabel)}
    title={sanitizeAvatarOptionalText(title)}
    {...props}
  />
  )
);
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(
  ({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted',
      className
    )}
    aria-label={sanitizeAvatarOptionalText(ariaLabel)}
    title={sanitizeAvatarOptionalText(title)}
    {...props}
  >
    {sanitizeAvatarNode(children)}
  </AvatarPrimitive.Fallback>
  )
);
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
