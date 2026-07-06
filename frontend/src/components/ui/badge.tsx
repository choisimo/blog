import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

function sanitizeBadgeText(value: unknown): string {
  return String(value ?? '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();
}

function sanitizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return value as string | undefined;
  const sanitized = sanitizeBadgeText(value);
  return sanitized || undefined;
}

function sanitizeBadgeNode(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string' || typeof node === 'number') {
    return sanitizeBadgeText(node);
  }

  if (Array.isArray(node)) {
    return node.map(sanitizeBadgeNode);
  }

  return node;
}

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/85',
        secondary:
          'border-[hsl(var(--tag-border))] bg-[hsl(var(--tag))] text-[hsl(var(--tag-foreground))] hover:bg-[hsl(var(--tag)/0.88)]',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85',
        outline: 'text-foreground border-border',
        muted:
          'border-[hsl(var(--tag-border)/0.85)] bg-[hsl(var(--tag)/0.7)] text-[hsl(var(--tag-foreground))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({
  className,
  variant,
  children,
  'aria-label': ariaLabel,
  title,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      aria-label={sanitizeOptionalText(ariaLabel)}
      title={sanitizeOptionalText(title)}
      {...props}
    >
      {sanitizeBadgeNode(children)}
    </div>
  );
}

export { Badge, badgeVariants };
