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

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeContentMetadataText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const normalized = String(value)
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeContentPostPath(value: unknown): string {
  const normalized = normalizeContentMetadataText(value);
  if (!normalized) return '';
  return normalized
    .split('/')
    .map((segment) => normalizeContentMetadataText(segment))
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function BlogPostContent({
  content,
  inlineEnabled,
  postTitle,
  postPath,
  isTerminal,
}: BlogPostContentProps) {
  const safePostTitle = normalizeContentMetadataText(postTitle, 'Untitled post');
  const safePostPath = normalizeContentPostPath(postPath);

  return (
    <section
      data-toc-boundary
      data-ai-block-scope='article'
      className={cn(
        '-mx-2 rounded-[28px] border border-white/50 bg-card/80 p-4 shadow-soft backdrop-blur-sm dark:border-white/5 dark:bg-[hsl(var(--card-blog)/0.9)] sm:mx-0 sm:p-7 lg:p-9',
        isTerminal &&
          'rounded-lg border-border bg-[hsl(var(--terminal-code-bg))]'
      )}
    >
      <div
        data-ai-block-content
        className={cn(
          'max-w-none',
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
            postTitle={safePostTitle}
            postPath={safePostPath}
          />
        </Suspense>
      </div>
    </section>
  );
}
