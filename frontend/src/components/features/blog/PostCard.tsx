import { memo, useMemo, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BlogPost } from '@/types/blog';
import { formatDate, resolveLocalizedPost } from '@/utils/content/blog';
import { stripMarkdown } from '@/utils/shared/common';
import { ArrowRight, Clock, Bookmark, BookmarkCheck } from 'lucide-react';
import { prefetchPost } from '@/data/content/posts';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsBookmarked } from '@/hooks/content/useBookmarks';
import { useTilt } from '@/hooks/gesture/useTilt';
import { useSwipe } from '@/hooks/gesture/useSwipe';
import useLanguage from '@/hooks/i18n/useLanguage';
import { cn } from '@/lib/utils';

type PostCardVariant = 'featured' | 'grid' | 'list' | 'mini';

interface PostCardProps {
  post: BlogPost;
  variant?: PostCardVariant;
  showTilt?: boolean;
  showBookmark?: boolean;
  className?: string;
  label?: string;
  title?: string;
  openLabel?: string;
  readLabel?: string;
  addBookmarkLabel?: string;
  removeBookmarkLabel?: string;
  saveSwipeLabel?: string;
  removeSwipeLabel?: string;
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

const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const SINGLE_LINE_CONTROL_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const WHITESPACE_PATTERN = /\s+/g;
const ENCODED_CONTROL_PATTERN = /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const SAFE_IMAGE_PROTOCOLS = new Set(['http:', 'https:']);
const DEFAULT_POST_CARD_LABEL = 'Blog post';
const DEFAULT_OPEN_LABEL = 'Open post';
const DEFAULT_ADD_BOOKMARK_LABEL = 'Add bookmark';
const DEFAULT_REMOVE_BOOKMARK_LABEL = 'Remove bookmark';
const DEFAULT_SAVE_SWIPE_LABEL = 'Save';
const DEFAULT_REMOVE_SWIPE_LABEL = 'Remove';

function decodePostCardSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeSingleLineText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, ' ')
    .replace(SINGLE_LINE_CONTROL_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeOptionalSingleLineText(value: unknown): string | undefined {
  return normalizeSingleLineText(value) || undefined;
}

function normalizePathSegment(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const raw = String(value).trim();
  const decoded = decodePostCardSegment(raw);
  if (
    !raw ||
    !decoded ||
    raw.includes('/') ||
    raw.includes('\\') ||
    decoded.includes('/') ||
    decoded.includes('\\') ||
    SINGLE_LINE_CONTROL_TEST_PATTERN.test(raw) ||
    SINGLE_LINE_CONTROL_TEST_PATTERN.test(decoded)
  ) {
    return undefined;
  }
  const normalized = normalizeSingleLineText(raw);
  return encodeURIComponent(normalized);
}

function normalizeImageSrc(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const raw = String(value).trim();
  if (
    !raw ||
    SINGLE_LINE_CONTROL_TEST_PATTERN.test(raw) ||
    ENCODED_CONTROL_PATTERN.test(raw) ||
    /\s/.test(raw)
  ) {
    return undefined;
  }
  const src = normalizeSingleLineText(raw);
  if (!src) return undefined;

  if (src.startsWith('/') && !src.startsWith('//')) {
    return src;
  }

  try {
    const parsed = new URL(src);
    return SAFE_IMAGE_PROTOCOLS.has(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}

const PostCard = memo(({
  post,
  variant = 'grid',
  showTilt = true,
  showBookmark = true,
  className,
  label = DEFAULT_POST_CARD_LABEL,
  title: cardTitle,
  openLabel = DEFAULT_OPEN_LABEL,
  readLabel: readLabelOverride,
  addBookmarkLabel = DEFAULT_ADD_BOOKMARK_LABEL,
  removeBookmarkLabel = DEFAULT_REMOVE_BOOKMARK_LABEL,
  saveSwipeLabel = DEFAULT_SAVE_SWIPE_LABEL,
  removeSwipeLabel = DEFAULT_REMOVE_SWIPE_LABEL,
}: PostCardProps) => {
  const location = useLocation();
  const { language } = useLanguage();
  const { isTerminal } = useTheme();
  const safeYear = normalizePathSegment(post.year);
  const safeSlug = normalizePathSegment(post.slug);
  const safePostId = safeYear && safeSlug ? `${safeYear}/${safeSlug}` : '';
  const { bookmarked, toggleBookmark } = useIsBookmarked(safePostId);
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

  const postUrl = safePostId ? `/blog/${safePostId}` : '/blog';
  const fromState = { pathname: location.pathname, search: location.search };
  const coverImage = normalizeImageSrc(post.coverImage);
  const title = normalizeSingleLineText(localized.title, 'Untitled');
  const safeCardLabel = normalizeSingleLineText(label, DEFAULT_POST_CARD_LABEL);
  const safeCardTitle = normalizeOptionalSingleLineText(cardTitle);
  const safeOpenLabel = normalizeSingleLineText(openLabel, DEFAULT_OPEN_LABEL);
  const category = normalizeSingleLineText(post.category, 'Uncategorized');
  const tags = Array.isArray(post.tags)
    ? post.tags
        .map(tag => normalizeSingleLineText(tag))
        .filter(Boolean)
    : [];
  const formattedDate = normalizeSingleLineText(formatDate(post.date, language));
  const handlePrefetch = () => {
    if (safeYear && safeSlug) {
      prefetchPost(safeYear, safeSlug);
    }
  };

  const displayText = useMemo(() => {
    const raw = localized.excerpt || localized.description || '';
    return normalizeSingleLineText(stripMarkdown(raw, variant === 'featured' ? 200 : 120));
  }, [localized.excerpt, localized.description, variant]);

  const readingTimeLabel = useMemo(() => {
    const raw = normalizeSingleLineText(post.readingTime || (post.readTime ? `${post.readTime} min` : ''));
    if (!raw) return '';
    const match = raw.match(/(\d+)/);
    if (language === 'ko') {
      const minutes = match ? match[1] : '';
      return minutes ? `${minutes}분` : raw;
    }
    return raw.replace('min read', 'min').replace('분 읽기', 'min');
  }, [language, post.readTime, post.readingTime]);
  const readLabel = normalizeSingleLineText(
    readLabelOverride,
    language === 'ko' ? '읽기' : 'Read'
  );
  const safeAddBookmarkLabel = normalizeSingleLineText(
    addBookmarkLabel,
    DEFAULT_ADD_BOOKMARK_LABEL
  );
  const safeRemoveBookmarkLabel = normalizeSingleLineText(
    removeBookmarkLabel,
    DEFAULT_REMOVE_BOOKMARK_LABEL
  );
  const safeSaveSwipeLabel = normalizeSingleLineText(saveSwipeLabel, DEFAULT_SAVE_SWIPE_LABEL);
  const safeRemoveSwipeLabel = normalizeSingleLineText(
    removeSwipeLabel,
    DEFAULT_REMOVE_SWIPE_LABEL
  );
  const bookmarkLabel = bookmarked ? safeRemoveBookmarkLabel : safeAddBookmarkLabel;
  const swipeLabel = bookmarked ? safeRemoveSwipeLabel : safeSaveSwipeLabel;

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
        aria-label={`${safeOpenLabel}: ${title}`}
        onMouseEnter={handlePrefetch}
        className={cn(
          'group flex items-center gap-3 p-3 rounded-lg transition-colors',
          'hover:bg-muted/50',
          isTerminal && 'hover:bg-primary/10 font-mono',
          className
        )}
      >
        {coverImage && (
          <div className="w-12 h-12 rounded-md overflow-hidden shrink-0">
            <OptimizedImage src={coverImage} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium truncate group-hover:text-primary transition-colors',
            isTerminal && 'terminal-glow'
          )}>
            {isTerminal && '> '}{title}
          </p>
          <p className="text-xs text-muted-foreground">{formattedDate}</p>
        </div>
      </Link>
    );
  }

  if (variant === 'list') {
    return (
      <article
        ref={showTilt ? combinedRef : swipeRef}
        aria-label={`${safeCardLabel}: ${title}`}
        title={safeCardTitle}
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
            <Bookmark aria-hidden="true" className="w-4 h-4" />
            <span>{swipeLabel}</span>
          </div>
        )}
        {coverImage && (
          <Link
            to={{ pathname: postUrl, search: location.search || undefined }}
            state={{ from: fromState }}
            aria-label={`${safeOpenLabel}: ${title}`}
            className="shrink-0 w-24 h-18 sm:w-32 sm:h-24 rounded-lg overflow-hidden"
            onMouseEnter={handlePrefetch}
          >
            <OptimizedImage
              src={coverImage}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </Link>
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn('text-[10px]', getCategoryColor(category), isTerminal && 'rounded font-mono')}>
              {isTerminal ? `[${category}]` : category}
            </Badge>
            {readingTimeLabel && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock aria-hidden="true" className="w-3 h-3" />
                {readingTimeLabel}
              </span>
            )}
          </div>
          <Link
            to={{ pathname: postUrl, search: location.search || undefined }}
            state={{ from: fromState }}
            aria-label={`${safeOpenLabel}: ${title}`}
            onMouseEnter={handlePrefetch}
            className={cn(
              'text-base font-semibold truncate group-hover:text-primary transition-colors',
              isTerminal && 'font-mono'
            )}
          >
            {isTerminal && '> '}{title}
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
            aria-label={bookmarkLabel}
          >
            {bookmarked ? <BookmarkCheck aria-hidden="true" className="w-4 h-4" /> : <Bookmark aria-hidden="true" className="w-4 h-4" />}
          </button>
        )}
      </article>
    );
  }

  const isFeatured = variant === 'featured';

  return (
    <article
      ref={showTilt ? combinedRef : swipeRef}
      aria-label={`${safeCardLabel}: ${title}`}
      title={safeCardTitle}
      className={cn(
        'group relative flex flex-col rounded-2xl border border-border/50 bg-card overflow-hidden transition-all active:scale-[0.99]',
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
          <Bookmark aria-hidden="true" className="w-4 h-4" />
          <span>{swipeLabel}</span>
        </div>
      )}
      <Link
        to={{ pathname: postUrl, search: location.search || undefined }}
        state={{ from: fromState }}
        aria-label={`${safeOpenLabel}: ${title}`}
        onMouseEnter={handlePrefetch}
        className={cn(
          'relative overflow-hidden',
          isFeatured ? 'md:w-3/5 aspect-[16/9] md:aspect-auto' : 'aspect-video'
        )}
      >
        {coverImage ? (
          <OptimizedImage
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted">
            <svg aria-hidden="true" className="w-12 h-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge className={cn('text-xs shadow-sm', getCategoryColor(category), isTerminal && 'rounded font-mono border-none')}>
            {isTerminal ? `[${category}]` : category}
          </Badge>
        </div>
      </Link>

      <div className={cn('flex flex-col flex-1 p-5', isFeatured && 'md:p-6 md:justify-center')}>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span>{formattedDate}</span>
          {readingTimeLabel && (
            <>
              <span aria-hidden="true">•</span>
              <span className="flex items-center gap-1">
                <Clock aria-hidden="true" className="w-3 h-3" />
                {readingTimeLabel}
              </span>
            </>
          )}
        </div>

        <Link
          to={{ pathname: postUrl, search: location.search || undefined }}
          state={{ from: fromState }}
          aria-label={`${safeOpenLabel}: ${title}`}
          onMouseEnter={handlePrefetch}
        >
          <h3 className={cn(
            'font-bold group-hover:text-primary transition-colors line-clamp-2',
            isFeatured ? 'text-xl md:text-2xl' : 'text-lg',
            isTerminal && 'font-mono terminal-glow'
          )}>
            {isTerminal && '> '}{title}
          </h3>
        </Link>

        <p className={cn(
          'text-muted-foreground mt-2 line-clamp-2',
          isFeatured ? 'text-base md:line-clamp-3' : 'text-sm'
        )}>
          {displayText}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 3).map(tag => (
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
            {tags.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <Button asChild variant="ghost" size="sm" className="group/btn -ml-2">
            <Link
              to={{ pathname: postUrl, search: location.search || undefined }}
              state={{ from: fromState }}
              aria-label={`${readLabel}: ${title}`}
              onMouseEnter={handlePrefetch}
            >
              {readLabel}
              <ArrowRight aria-hidden="true" className="ml-1.5 w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
            </Link>
          </Button>

          {showBookmark && (
            <button
              onClick={handleBookmarkClick}
              className={cn(
                'p-2 rounded-lg transition-colors',
                bookmarked ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
              )}
              aria-label={bookmarkLabel}
            >
              {bookmarked ? <BookmarkCheck aria-hidden="true" className="w-4 h-4" /> : <Bookmark aria-hidden="true" className="w-4 h-4" />}
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
