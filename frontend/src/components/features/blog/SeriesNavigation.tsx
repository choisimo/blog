import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { BlogPost } from '@/types/blog';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { prefetchPost } from '@/data/content/posts';

interface SeriesNavigationProps {
  currentPost: BlogPost;
  seriesPosts: BlogPost[];
  label?: string;
  title?: string;
  previousLabel?: string;
  nextLabel?: string;
  itemLabel?: string;
}

type SafeSeriesPost = BlogPost & {
  safeYear: string;
  safeSlug: string;
  safeTitle: string;
  safePath: string;
  safeOrder: number;
  safeDateTime: number;
};

const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const SINGLE_LINE_CONTROL_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const ENCODED_SINGLE_LINE_CONTROL_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_SERIES_LABEL = 'Series navigation';
const DEFAULT_PREVIOUS_LABEL = 'Previous series post';
const DEFAULT_NEXT_LABEL = 'Next series post';
const DEFAULT_ITEM_LABEL = 'Series post';

function decodeSeriesValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeSeriesText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, ' ')
    .replace(SINGLE_LINE_CONTROL_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeOptionalSeriesText(value: unknown): string | undefined {
  return normalizeSeriesText(value) || undefined;
}

function normalizePathSegment(value: unknown): string | undefined {
  const normalized = normalizeSeriesText(value);
  const decoded = decodeSeriesValue(normalized);
  if (
    !normalized ||
    !decoded ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    decoded.includes('/') ||
    decoded.includes('\\') ||
    SINGLE_LINE_CONTROL_TEST_PATTERN.test(decoded)
  ) {
    return undefined;
  }
  return encodeURIComponent(normalized);
}

function normalizeSearch(value: unknown): string {
  const search = normalizeSeriesText(value);
  if (/\s/.test(search) || ENCODED_SINGLE_LINE_CONTROL_PATTERN.test(search)) return '';
  return search.startsWith('?') && !search.startsWith('??') ? search : '';
}

function normalizeOrder(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : Number.POSITIVE_INFINITY;
}

function normalizeDateTime(value: unknown): number {
  const time = typeof value === 'string' || typeof value === 'number'
    ? new Date(value).getTime()
    : Number.NaN;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function normalizeSeriesPost(post: BlogPost): SafeSeriesPost | null {
  const safeYear = normalizePathSegment(post.year);
  const safeSlug = normalizePathSegment(post.slug);
  if (!safeYear || !safeSlug) return null;

  return {
    ...post,
    safeYear,
    safeSlug,
    safeTitle: normalizeSeriesText(post.title, 'Untitled'),
    safePath: `/blog/${safeYear}/${safeSlug}`,
    safeOrder: normalizeOrder(post.seriesOrder),
    safeDateTime: normalizeDateTime(post.date),
  };
}

export const SeriesNavigation = ({
  currentPost,
  seriesPosts,
  label = DEFAULT_SERIES_LABEL,
  title,
  previousLabel = DEFAULT_PREVIOUS_LABEL,
  nextLabel = DEFAULT_NEXT_LABEL,
  itemLabel = DEFAULT_ITEM_LABEL,
}: SeriesNavigationProps) => {
  const { isTerminal } = useTheme();
  const location = useLocation();
  const preservedSearch = normalizeSearch(location.search);

  const sortedPosts = useMemo(() => {
    return seriesPosts.flatMap(post => {
      const normalized = normalizeSeriesPost(post);
      return normalized ? [normalized] : [];
    }).sort((a, b) => {
      if (Number.isFinite(a.safeOrder) && Number.isFinite(b.safeOrder)) {
        return a.safeOrder - b.safeOrder;
      }
      return a.safeDateTime - b.safeDateTime;
    });
  }, [seriesPosts]);
  const safeCurrentYear = normalizePathSegment(currentPost.year);
  const safeCurrentSlug = normalizePathSegment(currentPost.slug);

  const currentIndex = sortedPosts.findIndex(
    p => p.safeYear === safeCurrentYear && p.safeSlug === safeCurrentSlug
  );

  const prevPost = currentIndex > 0 ? sortedPosts[currentIndex - 1] : null;
  const nextPost =
    currentIndex < sortedPosts.length - 1 ? sortedPosts[currentIndex + 1] : null;

  if (sortedPosts.length < 2) return null;

  const seriesTitle = normalizeSeriesText(currentPost.series)
    ?.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Series';
  const safeLabel = normalizeSeriesText(label, DEFAULT_SERIES_LABEL);
  const safeTitle = normalizeOptionalSeriesText(title);
  const safePreviousLabel = normalizeSeriesText(previousLabel, DEFAULT_PREVIOUS_LABEL);
  const safeNextLabel = normalizeSeriesText(nextLabel, DEFAULT_NEXT_LABEL);
  const safeItemLabel = normalizeSeriesText(itemLabel, DEFAULT_ITEM_LABEL);

  const handlePrefetch = (post: SafeSeriesPost) => {
    prefetchPost(post.safeYear, post.safeSlug);
  };

  return (
    <section
      aria-label={safeLabel}
      title={safeTitle}
      className={cn(
        'rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur',
        isTerminal && 'rounded-lg border-border bg-[hsl(var(--terminal-code-bg))]'
      )}
    >
      <div className='flex items-center gap-2 mb-4'>
        <div
          className={cn(
            'rounded-full bg-primary/10 p-2',
            isTerminal && 'rounded bg-transparent border border-primary/40'
          )}
        >
          <ListOrdered aria-hidden='true' className='h-4 w-4 text-primary' />
        </div>
        <div>
          <h3
            className={cn(
              'text-sm font-semibold text-foreground',
              isTerminal && 'font-mono text-primary'
            )}
          >
            {isTerminal ? `> Series: ${seriesTitle}` : `Series: ${seriesTitle}`}
          </h3>
          <p className={cn('text-xs text-muted-foreground', isTerminal && 'font-mono')}>
            {currentIndex + 1} / {sortedPosts.length}
          </p>
        </div>
      </div>

      <div className='space-y-2 mb-4'>
        {sortedPosts.map((post, idx) => {
          const isCurrent =
            post.safeYear === safeCurrentYear && post.safeSlug === safeCurrentSlug;
          return (
            <Link
              key={`${post.safeYear}/${post.safeSlug}`}
              to={{
                pathname: post.safePath,
                search: preservedSearch || undefined,
              }}
              onMouseEnter={() => handlePrefetch(post)}
              onFocus={() => handlePrefetch(post)}
              aria-label={`${safeItemLabel} ${idx + 1}: ${post.safeTitle}`}
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isCurrent
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                isTerminal && 'rounded font-mono text-xs',
                isTerminal && isCurrent && 'border border-primary/40'
              )}
            >
              <span
                className={cn(
                  'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs',
                  isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                  isTerminal && 'rounded'
                )}
              >
                {idx + 1}
              </span>
              <span className='truncate'>{post.safeTitle}</span>
            </Link>
          );
        })}
      </div>

      <div className='flex items-center justify-between gap-3 pt-3 border-t border-border/60'>
        {prevPost ? (
          <Link
            to={{
              pathname: prevPost.safePath,
              search: preservedSearch || undefined,
            }}
            onMouseEnter={() => handlePrefetch(prevPost)}
            onFocus={() => handlePrefetch(prevPost)}
            aria-label={`${safePreviousLabel}: ${prevPost.safeTitle}`}
            className={cn(
              'flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors',
              isTerminal && 'font-mono text-xs'
            )}
          >
            <ChevronLeft aria-hidden='true' className='h-4 w-4' />
            <span className='truncate max-w-[120px] sm:max-w-[180px]'>
              {prevPost.safeTitle}
            </span>
          </Link>
        ) : (
          <div />
        )}
        {nextPost ? (
          <Link
            to={{
              pathname: nextPost.safePath,
              search: preservedSearch || undefined,
            }}
            onMouseEnter={() => handlePrefetch(nextPost)}
            onFocus={() => handlePrefetch(nextPost)}
            aria-label={`${safeNextLabel}: ${nextPost.safeTitle}`}
            className={cn(
              'flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors ml-auto',
              isTerminal && 'font-mono text-xs'
            )}
          >
            <span className='truncate max-w-[120px] sm:max-w-[180px]'>
              {nextPost.safeTitle}
            </span>
            <ChevronRight aria-hidden='true' className='h-4 w-4' />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </section>
  );
};

export default SeriesNavigation;
