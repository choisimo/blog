import * as React from 'react';

import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeSkeletonText = (value: string | number): string =>
  String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();

const sanitizeSkeletonOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeSkeletonText(value);
  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeSkeletonNode = (children: React.ReactNode): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeSkeletonText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeSkeletonNode);
  }

  return children;
};

function Skeleton({
  className,
  children,
  'aria-label': ariaLabel,
  title,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/80 dark:bg-muted/50',
        className
      )}
      aria-label={sanitizeSkeletonOptionalText(ariaLabel)}
      title={sanitizeSkeletonOptionalText(title)}
      {...props}
    >
      {sanitizeSkeletonNode(children)}
    </div>
  );
}

export { Skeleton };
