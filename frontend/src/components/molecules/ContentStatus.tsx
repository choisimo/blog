import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ContentStatusProps {
  kind: 'loading' | 'empty' | 'error' | 'notice';
  children: ReactNode;
  className?: string;
}

/** A persistent, local message; it never infers network success or retries writes. */
export function ContentStatus({ kind, children, className }: ContentStatusProps) {
  return (
    <div className={cn('ui-status', `ui-status--${kind}`, className)}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      aria-busy={kind === 'loading'}>
      <p>{children}</p>
    </div>
  );
}
