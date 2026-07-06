import { memo, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BlogPost } from '@/types/blog';
import { formatDate, resolveLocalizedPost } from '@/utils/content/blog';
import { stripMarkdown } from '@/utils/shared/common';
import { ArrowRight, Clock, User } from 'lucide-react';
import { DateDisplay, TagList } from '@/components/atoms';
import { prefetchPost } from '@/data/content/posts';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import useLanguage from '@/hooks/i18n/useLanguage';

interface BlogCardProps {
  post: BlogPost;
  label?: string;
  title?: string;
  readMoreLabel?: string;
}

const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const SINGLE_LINE_CONTROL_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const WHITESPACE_PATTERN = /\s+/g;
const ENCODED_CONTROL_PATTERN = /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const SAFE_IMAGE_PROTOCOLS = new Set(['http:', 'https:']);
const DEFAULT_BLOG_CARD_LABEL = 'Blog post';

function decodeBlogCardSegment(value: string): string | null {
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
  const decoded = decodeBlogCardSegment(raw);
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

const BlogCard = memo(({
  post,
  label = DEFAULT_BLOG_CARD_LABEL,
  title: cardTitle,
  readMoreLabel: readMoreLabelOverride,
}: BlogCardProps) => {
  const location = useLocation();
  const { language } = useLanguage();
  const localized = useMemo(
    () => resolveLocalizedPost(post, language),
    [language, post]
  );

  const search = location.search;
  const fromState = {
    pathname: location.pathname,
    search,
  } as const;

  const safeYear = normalizePathSegment(post.year);
  const safeSlug = normalizePathSegment(post.slug);
  const postUrl = safeYear && safeSlug ? `/blog/${safeYear}/${safeSlug}` : '/blog';
  const coverImage = normalizeImageSrc(post.coverImage);
  const title = normalizeSingleLineText(localized.title, 'Untitled');
  const safeCardLabel = normalizeSingleLineText(label, DEFAULT_BLOG_CARD_LABEL);
  const safeCardTitle = normalizeOptionalSingleLineText(cardTitle);
  const category = normalizeSingleLineText(post.category, 'Uncategorized');
  const author = normalizeSingleLineText(post.author);
  const tags = Array.isArray(post.tags)
    ? post.tags
        .map(tag => normalizeSingleLineText(tag))
        .filter(Boolean)
    : [];

  const handlePrefetch = () => {
    if (safeYear && safeSlug) {
      prefetchPost(safeYear, safeSlug);
    }
  };

  // Display excerpt or description with markdown stripped
  const displayText = useMemo(() => {
    const raw = localized.excerpt || localized.description || '';
    return normalizeSingleLineText(stripMarkdown(raw, 150));
  }, [localized.excerpt, localized.description]);

  const readingTimeLabel = useMemo(() => {
    const raw = normalizeSingleLineText(
      post.readingTime || (post.readTime ? `${post.readTime} min read` : '')
    );
    if (!raw) return '';
    const match = raw.match(/(\d+)/);
    if (language === 'ko') {
      const minutes = match ? match[1] : '';
      if (minutes) return `${minutes}분 읽기`;
      return raw.includes('분') ? raw : raw.replace('min read', '분 읽기');
    }
    // English fallback
    if (raw.includes('분')) {
      const minutes = match ? match[1] : '';
      if (minutes) return `${minutes} min read`;
    }
    return raw;
  }, [language, post.readTime, post.readingTime]);

  const readMoreLabel = normalizeSingleLineText(
    readMoreLabelOverride,
    language === 'ko' ? '더 읽기' : 'Read more'
  );

  const formattedDate = normalizeSingleLineText(formatDate(post.date, language));

  return (
    <Card
      role='article'
      aria-label={`${safeCardLabel}: ${title}`}
      title={safeCardTitle}
      className='h-full flex flex-col hover:shadow-lg transition-all duration-300 group border-border/50 hover:border-border'
    >
      {/* Cover image or placeholder */}
      <div className='aspect-video overflow-hidden bg-muted/40'>
        {coverImage ? (
          <OptimizedImage
            src={coverImage}
            alt={title}
            className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
          />
        ) : (
          <div className='w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50'>
            <svg
              className='w-10 h-10 text-muted-foreground/50'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              aria-hidden='true'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
              />
            </svg>
          </div>
        )}
      </div>

      <CardHeader className='pb-0 px-6 pt-6 md:px-8 md:pt-8'>
        <div className='flex justify-between items-start gap-2 mb-3'>
          <Badge variant='secondary' className='text-xs'>
            {category}
          </Badge>
          <DateDisplay date={formattedDate} />
        </div>
        <CardTitle className='line-clamp-2 group-hover:text-primary transition-colors leading-tight font-extrabold'>
          <Link
            to={{ pathname: postUrl, search: search || undefined }}
              state={{ from: fromState }}
              className='hover:underline'
              aria-label={title}
              onMouseEnter={handlePrefetch}
              onFocus={handlePrefetch}
            >
            {title}
          </Link>
        </CardTitle>
      </CardHeader>

      <CardContent className='flex-1 pt-3 px-6 md:px-8'>
        <CardDescription className='line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400'>
          {displayText}
        </CardDescription>
      </CardContent>

      <CardFooter className='flex flex-col gap-3 pt-3 px-6 pb-6 md:px-8'>
        {/* Metadata row */}
        <div className='flex items-center justify-between w-full text-xs text-muted-foreground'>
          <div className='flex items-center gap-4'>
            {/* Reading time */}
            {(post.readingTime || post.readTime) && readingTimeLabel && (
              <div className='flex items-center gap-1'>
                <Clock aria-hidden='true' className='h-3 w-3' />
                <span>{readingTimeLabel}</span>
              </div>
            )}

            {/* Author */}
            {author && (
              <div className='flex items-center gap-1'>
                <User aria-hidden='true' className='h-3 w-3' />
                <span>{author}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className='w-full'>
            <TagList
              tags={tags}
              maxVisible={3}
              size='sm'
              showIcon={false}
              variant='secondary'
            />
          </div>
        )}

        {/* Read more button */}
        <Button asChild variant='ghost' className='w-full group/button mt-2'>
          <Link
            to={{ pathname: postUrl, search: search || undefined }}
            state={{ from: fromState }}
            aria-label={`${readMoreLabel}: ${title}`}
            onMouseEnter={handlePrefetch}
            onFocus={handlePrefetch}
          >
            {readMoreLabel}
            <ArrowRight aria-hidden='true' className='ml-2 h-4 w-4 transition-transform group-hover/button:translate-x-1' />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
});

BlogCard.displayName = 'BlogCard';

export default BlogCard;
