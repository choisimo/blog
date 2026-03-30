import * as React from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  ({ className, ...props }, ref) => (
    <Button
      ref={ref}
      size="icon"
      className={cn(
        'min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0',
        className,
      )}
      {...props}
    />
  ),
);
TouchIconButton.displayName = 'TouchIconButton';

export { TouchIconButton };
