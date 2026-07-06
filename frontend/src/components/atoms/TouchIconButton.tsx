import * as React from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

function sanitizeAccessibleText(value: unknown): string | undefined {
  if (typeof value !== 'string') return value;
  const sanitized = value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();
  return sanitized || undefined;
}

function sanitizeTouchIconButtonNode(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeAccessibleText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeTouchIconButtonNode);
  }

  return children;
}

/**
 * Icon button wrapper that guarantees a 44×44 px minimum touch target on mobile
 * while preserving the compact desktop density via the `sm:` breakpoint reset.
 *
 * Usage — drop-in replacement for `<Button size="icon" …>`:
 *
 *   <TouchIconButton variant="ghost" className="h-9 w-9 …">
 *     <Moon className="h-4 w-4" />
 *   </TouchIconButton>
 */
const TouchIconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => {
    const safeAriaLabel = sanitizeAccessibleText(ariaLabel);
    const safeTitle = sanitizeAccessibleText(title);

    return (
      <Button
        ref={ref}
        size="icon"
        aria-label={safeAriaLabel}
        title={safeTitle}
        className={cn(
          'min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0',
          className,
        )}
        {...props}
      >
        {sanitizeTouchIconButtonNode(children)}
      </Button>
    );
  },
);
TouchIconButton.displayName = 'TouchIconButton';

export { TouchIconButton };
