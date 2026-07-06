import * as React from 'react';

import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

function sanitizeDisplayText(value: unknown): string | undefined {
  if (typeof value !== 'string') return value as string | undefined;
  const sanitized = value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();
  return sanitized || undefined;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, placeholder, 'aria-label': ariaLabel, title, ...props },
    ref
  ) => {
    const safePlaceholder = sanitizeDisplayText(placeholder);
    const safeAriaLabel = sanitizeDisplayText(ariaLabel);
    const safeTitle = sanitizeDisplayText(title);

    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          className
        )}
        ref={ref}
        placeholder={safePlaceholder}
        aria-label={safeAriaLabel}
        title={safeTitle}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
