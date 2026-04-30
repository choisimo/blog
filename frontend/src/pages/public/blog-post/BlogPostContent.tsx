import { Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const MarkdownRenderer = lazy(
  () => import('@/components/features/blog/MarkdownRenderer')
);

interface BlogPostContentProps {
  content: string;
  inlineEnabled: boolean;
  postTitle: string;
  postPath: string;
  isTerminal: boolean;
}

export function BlogPostContent({
  content,
  inlineEnabled,
  postTitle,
  postPath,
  isTerminal,
}: BlogPostContentProps) {
  return (
    <section
      data-toc-boundary
      data-ai-block-scope='article'
      className={cn(
        'border-t border-slate-200/80 pt-8 dark:border-white/10 sm:pt-10',
        isTerminal &&
          'rounded-lg border border-border bg-[hsl(var(--terminal-code-bg))] p-4 sm:p-6'
      )}
    >
      <div
        data-ai-block-content
        className={cn(
          'prose prose-gray max-w-none dark:prose-invert',
          isTerminal && 'prose-headings:font-mono prose-headings:terminal-glow'
        )}
      >
        <Suspense
          fallback={
            <div className='space-y-3' aria-label='Loading article content'>
              <Skeleton className='h-6 w-3/4' />
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-11/12' />
              <Skeleton className='h-4 w-10/12' />
              <Skeleton className='h-4 w-9/12' />
              <Skeleton className='h-4 w-1/2' />
            </div>
          }
        >
          <MarkdownRenderer
            content={content}
            inlineEnabled={inlineEnabled}
            postTitle={postTitle}
            postPath={postPath}
          />
        </Suspense>
      </div>
    </section>
  );
}
