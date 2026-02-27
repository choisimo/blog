import { memo, useMemo, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BlogPost } from '@/types/blog';
import { formatDate, resolveLocalizedPost } from '@/utils/blog';
import { stripMarkdown } from '@/utils/common';
import { ArrowRight, Clock, Bookmark, BookmarkCheck } from 'lucide-react';
import { prefetchPost } from '@/data/posts';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsBookmarked } from '@/hooks/useBookmarks';
import { useTilt } from '@/hooks/useTilt';
import { useSwipe } from '@/hooks/useSwipe';
import useLanguage from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

type PostCardVariant = 'featured' | 'grid' | 'list' | 'mini';

interface PostCardProps {
  post: BlogPost;
  variant?: PostCardVariant;
  showTilt?: boolean;
  showBookmark?: boolean;
  className?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'AI': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Development': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'DevOps': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Tutorial': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Essay': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'Review': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || 'bg-secondary text-secondary-foreground';
}

const PostCard = memo(({
  post,
  variant = 'grid',
  showTilt = true,
  showBookmark = true,
  className,
}: PostCardProps) => {
  const location = useLocation();
  const { language } = useLanguage();
  const { isTerminal } = useTheme();
  const { bookmarked, toggleBookmark } = useIsBookmarked(`${post.year}/${post.slug}`);
  const tiltRef = useTilt<HTMLDivElement>({ max: 8, scale: 1.02, glare: !isTerminal });
  const [swipeHint, setSwipeHint] = useState(false);

  // Swipe gesture for mobile bookmark toggle
  const { ref: swipeRef, deltaX, swiping } = useSwipe<HTMLDivElement>({
    threshold: 60,
    onSwipeRight: () => {
      if (showBookmark) {
        toggleBookmark();
        setSwipeHint(true);
        setTimeout(() => setSwipeHint(false), 1000);
      }
    },
  });

  // Calculate swipe visual offset (capped at 80px)
  const swipeOffset = swiping === 'right' ? Math.min(deltaX, 80) : 0;
  const swipeProgress = swipeOffset / 80;

  // Combine refs for tilt and swipe
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    // Set tiltRef
    if (tiltRef && 'current' in tiltRef) {
      (tiltRef as { current: HTMLDivElement | null }).current = node;
    }
    // Set swipeRef
    if (swipeRef && 'current' in swipeRef) {
      (swipeRef as { current: HTMLDivElement | null }).current = node;
    }
  }, [tiltRef, swipeRef]);

  const localized = useMemo(() => resolveLocalizedPost(post, language), [language, post]);

  const postUrl = `/blog/${post.year}/${post.slug}`;
  const fromState = { pathname: location.pathname, search: location.search };

  const displayText = useMemo(() => {
    const raw = localized.excerpt || localized.description || '';
    return stripMarkdown(raw, variant === 'featured' ? 200 : 120);
  }, [localized.excerpt, localized.description, variant]);

  const readingTimeLabel = useMemo(() => {
    const raw = post.readingTime || (post.readTime ? `${post.readTime} min` : '');
    if (!raw) return '';
    const match = raw.match(/(\d+)/);
    if (language === 'ko') {
      const minutes = match ? match[1] : '';
      return minutes ? `${minutes}분` : raw;
    }
    return raw.replace('min read', 'min').replace('분 읽기', 'min');
  }, [language, post.readTime, post.readingTime]);

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleBookmark();
  };

  if (variant === 'mini') {
    return (
      <Link
        to={{ pathname: postUrl, search: location.search || undefined }}
        state={{ from: fromState }}
        onMouseEnter={() => prefetchPost(post.year, post.slug)}
        className={cn(
          'group flex items-center gap-3 p-3 rounded-lg transition-colors',
          'hover:bg-muted/50',
          isTerminal && 'hover:bg-primary/10 font-mono',
          className
        )}
      >
        {post.coverImage && (
          <div className="w-12 h-12 rounded-md overflow-hidden shrink-0">
            <OptimizedImage src={post.coverImage} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium truncate group-hover:text-primary transition-colors',
            isTerminal && 'terminal-glow'
          )}>
            {isTerminal && '> '}{localized.title}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(post.date, language)}</p>
        </div>
      </Link>
    );
  }

  if (variant === 'list') {
    return (
      <article
        ref={showTilt ? combinedRef : swipeRef}
        className={cn(
          'group flex gap-4 p-4 rounded-xl border border-border/50 bg-card transition-all',
          'hover:shadow-lg hover:border-primary/30',
          isTerminal && 'border-border bg-[hsl(var(--terminal-code-bg))] hover:border-primary hover:shadow-[0_0_15px_hsl(var(--primary)/0.2)]',
          swipeProgress > 0 && 'bg-primary/10',
          swipeHint && 'ring-2 ring-primary/50',
          className
        )}
        style={swipeOffset > 0 ? { transform: `translateX(${swipeOffset * 0.3}px)` } : undefined}
      >
        {/* Swipe hint indicator */}
        {swipeProgress > 0.3 && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 text-primary text-xs font-medium">
            <Bookmark className="w-4 h-4" />
            <span>{bookmarked ? 'Remove' : 'Save'}</span>
          </div>
        )}
        {post.coverImage && (
          <Link
            to={{ pathname: postUrl, search: location.search || undefined }}
            state={{ from: fromState }}
            className="shrink-0 w-24 h-18 sm:w-32 sm:h-24 rounded-lg overflow-hidden"
            onMouseEnter={() => prefetchPost(post.year, post.slug)}
          >
            <OptimizedImage
              src={post.coverImage}
              alt={localized.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </Link>
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn('text-[10px]', getCategoryColor(post.category), isTerminal && 'rounded font-mono')}>
              {isTerminal ? `[${post.category}]` : post.category}
            </Badge>
            {readingTimeLabel && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {readingTimeLabel}
              </span>
            )}
          </div>
          <Link
            to={{ pathname: postUrl, search: location.search || undefined }}
            state={{ from: fromState }}
            onMouseEnter={() => prefetchPost(post.year, post.slug)}
            className={cn(
              'text-base font-semibold truncate group-hover:text-primary transition-colors',
              isTerminal && 'font-mono'
            )}
          >
            {isTerminal && '> '}{localized.title}
          </Link>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{displayText}</p>
        </div>
        {showBookmark && (
          <button
            onClick={handleBookmarkClick}
            className={cn(
              'shrink-0 p-2 rounded-lg transition-colors',
              bookmarked ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
            )}
            aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            {bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>
        )}
      </article>
    );
  }

  const isFeatured = variant === 'featured';

  return (
    <article
      ref={showTilt ? combinedRef : swipeRef}
      className={cn(
        'group relative flex flex-col rounded-2xl border border-border/50 bg-card overflow-hidden transition-all',
        'hover:shadow-xl hover:border-primary/30',
        isTerminal && 'rounded-lg border-border bg-[hsl(var(--terminal-code-bg))] hover:border-primary hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]',
        isFeatured && 'md:flex-row',
        swipeProgress > 0 && 'bg-primary/10',
        swipeHint && 'ring-2 ring-primary/50',
        className
      )}
      style={swipeOffset > 0 ? { transform: `translateX(${swipeOffset * 0.3}px)` } : undefined}
    >
      {/* Swipe hint indicator */}
      {swipeProgress > 0.3 && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 text-primary text-xs font-medium bg-card/90 px-2 py-1 rounded-lg">
          <Bookmark className="w-4 h-4" />
          <span>{bookmarked ? 'Remove' : 'Save'}</span>
        </div>
      )}
      <Link
        to={{ pathname: postUrl, search: location.search || undefined }}
        state={{ from: fromState }}
        onMouseEnter={() => prefetchPost(post.year, post.slug)}
        className={cn(
          'relative overflow-hidden',
          isFeatured ? 'md:w-3/5 aspect-[16/9] md:aspect-auto' : 'aspect-video'
        )}
      >
        {post.coverImage ? (
          <OptimizedImage
            src={post.coverImage}
            alt={localized.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted">
            <svg className="w-12 h-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge className={cn('text-xs shadow-sm', getCategoryColor(post.category), isTerminal && 'rounded font-mono border-none')}>
            {isTerminal ? `[${post.category}]` : post.category}
          </Badge>
        </div>
      </Link>

      <div className={cn('flex flex-col flex-1 p-5', isFeatured && 'md:p-6 md:justify-center')}>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span>{formatDate(post.date, language)}</span>
          {readingTimeLabel && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {readingTimeLabel}
              </span>
            </>
          )}
        </div>

        <Link
          to={{ pathname: postUrl, search: location.search || undefined }}
          state={{ from: fromState }}
          onMouseEnter={() => prefetchPost(post.year, post.slug)}
        >
          <h3 className={cn(
            'font-bold group-hover:text-primary transition-colors line-clamp-2',
            isFeatured ? 'text-xl md:text-2xl' : 'text-lg',
            isTerminal && 'font-mono terminal-glow'
          )}>
            {isTerminal && '> '}{localized.title}
          </h3>
        </Link>

        <p className={cn(
          'text-muted-foreground mt-2 line-clamp-2',
          isFeatured ? 'text-base md:line-clamp-3' : 'text-sm'
        )}>
          {displayText}
        </p>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.slice(0, 3).map(tag => (
              <Badge
                key={tag}
                variant="outline"
                className={cn(
                  'text-[10px] px-2 py-0.5',
                  isTerminal && 'rounded border-primary/40 text-primary font-mono'
                )}
              >
                {isTerminal ? `#${tag}` : `#${tag}`}
              </Badge>
            ))}
            {post.tags.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                +{post.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <Button asChild variant="ghost" size="sm" className="group/btn -ml-2">
            <Link
              to={{ pathname: postUrl, search: location.search || undefined }}
              state={{ from: fromState }}
              onMouseEnter={() => prefetchPost(post.year, post.slug)}
            >
              {language === 'ko' ? '읽기' : 'Read'}
              <ArrowRight className="ml-1.5 w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
            </Link>
          </Button>

          {showBookmark && (
            <button
              onClick={handleBookmarkClick}
              className={cn(
                'p-2 rounded-lg transition-colors',
                bookmarked ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
              )}
              aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
            >
              {bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

PostCard.displayName = 'PostCard';

export { PostCard };
export default PostCard;
