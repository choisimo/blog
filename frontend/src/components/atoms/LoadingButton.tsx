import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
}

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

function sanitizeLoadingText(value: unknown): string {
  return String(value ?? '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();
}

function sanitizeOptionalLoadingText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeLoadingText(value);

  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeLoadingButtonNode(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeLoadingText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeLoadingButtonNode);
  }

  return children;
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      isLoading = false,
      loadingText,
      children,
      disabled,
      className,
      'aria-label': ariaLabel,
      title,
      ...props
    },
    ref,
  ) => {
    const safeLoadingText = sanitizeLoadingText(loadingText);
    const safeChildren = sanitizeLoadingButtonNode(children);

    return (
      <Button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn('relative', className)}
        aria-label={sanitizeOptionalLoadingText(ariaLabel)}
        title={sanitizeOptionalLoadingText(title)}
        {...props}
      >
        {isLoading && (
          <Loader2
            className="mr-2 h-4 w-4 animate-spin"
            aria-hidden="true"
          />
        )}
        {isLoading && safeLoadingText ? safeLoadingText : safeChildren}
      </Button>
    );
  },
);
LoadingButton.displayName = 'LoadingButton';

export { LoadingButton };
