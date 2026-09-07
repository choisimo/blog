import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  width?: 'content' | 'article' | 'wide';
}

/** Layout only: the route-level main landmark remains owned by App. */
export function PageContainer({ width = 'content', className, ...props }: PageContainerProps) {
  return <div {...props} className={cn('ui-container', width !== 'content' && `ui-container--${width}`, className)} />;
}
