import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

function sanitizeAccessibleText(value: unknown): string | undefined {
  if (typeof value !== 'string') return value as string | undefined;
  const sanitized = value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();
  return sanitized || undefined;
}

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/85 shadow-sm',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        outline:
          'border border-border bg-card hover:bg-accent hover:text-accent-foreground hover:border-border/80',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-transparent hover:border-border/50',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // Terminal/Cyber-Minimalism variants
        terminal:
          'bg-transparent border border-[hsl(var(--terminal-inactive-border,var(--border)))] text-muted-foreground font-mono uppercase tracking-wider hover:border-primary hover:text-primary hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)] hover:[text-shadow:0_0_5px_hsl(var(--primary))]',
        'terminal-active':
          'bg-primary text-[hsl(210_50%_2%)] border border-primary font-mono uppercase tracking-wider shadow-[0_0_10px_hsl(var(--primary)/0.4)]',
        'terminal-danger':
          'bg-transparent border border-destructive/50 text-destructive font-mono uppercase tracking-wider hover:bg-destructive hover:text-white hover:shadow-[0_0_10px_hsl(var(--destructive)/0.5)]',
      },
      size: {
        default: 'h-10 px-4 py-2 rounded-xl',
        sm: 'h-9 rounded-xl px-3',
        lg: 'h-11 rounded-xl px-8',
        icon: 'h-10 w-10 rounded-xl',
        // Terminal size: 더 날렵한 radius
        terminal: 'h-9 px-4 py-2 rounded-[4px] text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, 'aria-label': ariaLabel, title, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const safeAriaLabel = sanitizeAccessibleText(ariaLabel);
    const safeTitle = sanitizeAccessibleText(title);

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-label={safeAriaLabel}
        title={safeTitle}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
