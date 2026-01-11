import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { BlogPost } from '@/types/blog';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { prefetchPost } from '@/data/posts';

interface SeriesNavigationProps {
  currentPost: BlogPost;
  seriesPosts: BlogPost[];
}

export const SeriesNavigation = ({
  currentPost,
  seriesPosts,
}: SeriesNavigationProps) => {
  const { isTerminal } = useTheme();
  const location = useLocation();
  const preservedSearch = location.search || '';

  const sortedPosts = useMemo(() => {
    return [...seriesPosts].sort((a, b) => {
      if (a.seriesOrder !== undefined && b.seriesOrder !== undefined) {
        return a.seriesOrder - b.seriesOrder;
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [seriesPosts]);

  const currentIndex = sortedPosts.findIndex(
    p => p.year === currentPost.year && p.slug === currentPost.slug
  );

  const prevPost = currentIndex > 0 ? sortedPosts[currentIndex - 1] : null;
  const nextPost =
    currentIndex < sortedPosts.length - 1 ? sortedPosts[currentIndex + 1] : null;

  if (sortedPosts.length < 2) return null;

  const seriesTitle = currentPost.series
    ?.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <section
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
          <ListOrdered className='h-4 w-4 text-primary' />
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
            post.year === currentPost.year && post.slug === currentPost.slug;
          return (
            <Link
              key={`${post.year}/${post.slug}`}
              to={{
                pathname: `/blog/${post.year}/${post.slug}`,
                search: preservedSearch || undefined,
              }}
              onMouseEnter={() => prefetchPost(post.year, post.slug)}
              onFocus={() => prefetchPost(post.year, post.slug)}
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
              <span className='truncate'>{post.title}</span>
            </Link>
          );
        })}
      </div>

      <div className='flex items-center justify-between gap-3 pt-3 border-t border-border/60'>
        {prevPost ? (
          <Link
            to={{
              pathname: `/blog/${prevPost.year}/${prevPost.slug}`,
              search: preservedSearch || undefined,
            }}
            onMouseEnter={() => prefetchPost(prevPost.year, prevPost.slug)}
            onFocus={() => prefetchPost(prevPost.year, prevPost.slug)}
            className={cn(
              'flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors',
              isTerminal && 'font-mono text-xs'
            )}
          >
            <ChevronLeft className='h-4 w-4' />
            <span className='truncate max-w-[120px] sm:max-w-[180px]'>
              {prevPost.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
        {nextPost ? (
          <Link
            to={{
              pathname: `/blog/${nextPost.year}/${nextPost.slug}`,
              search: preservedSearch || undefined,
            }}
            onMouseEnter={() => prefetchPost(nextPost.year, nextPost.slug)}
            onFocus={() => prefetchPost(nextPost.year, nextPost.slug)}
            className={cn(
              'flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors ml-auto',
              isTerminal && 'font-mono text-xs'
            )}
          >
            <span className='truncate max-w-[120px] sm:max-w-[180px]'>
              {nextPost.title}
            </span>
            <ChevronRight className='h-4 w-4' />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </section>
  );
};

export default SeriesNavigation;
