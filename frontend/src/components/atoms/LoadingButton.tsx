import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    { isLoading = false, loadingText, children, disabled, className, ...props },
    ref,
  ) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn('relative', className)}
        {...props}
      >
        {isLoading && (
          <Loader2
            className="mr-2 h-4 w-4 animate-spin"
            aria-hidden="true"
          />
        )}
        {isLoading && loadingText ? loadingText : children}
      </Button>
    );
  },
);
LoadingButton.displayName = 'LoadingButton';

export { LoadingButton };
