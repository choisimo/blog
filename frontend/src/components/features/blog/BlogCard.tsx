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
import { formatDate, resolveLocalizedPost } from '@/utils/blog';
import { stripMarkdown } from '@/utils/common';
import { ArrowRight, Clock, User } from 'lucide-react';
import { DateDisplay, TagList } from '@/components/atoms';
import { prefetchPost } from '@/data/posts';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import useLanguage from '@/hooks/useLanguage';

interface BlogCardProps {
  post: BlogPost;
}

const BlogCard = memo(({ post }: BlogCardProps) => {
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

  // Create the proper blog post URL using year and slug
  const postUrl = `/blog/${post.year}/${post.slug}`;

  // Display excerpt or description with markdown stripped
  const displayText = useMemo(() => {
    const raw = localized.excerpt || localized.description || '';
    return stripMarkdown(raw, 150);
  }, [localized.excerpt, localized.description]);

  const readingTimeLabel = useMemo(() => {
    const raw = post.readingTime || (post.readTime ? `${post.readTime} min read` : '');
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

  const readMoreLabel = language === 'ko' ? '더 읽기' : 'Read more';

  const formattedDate = formatDate(post.date, language);

  return (
    <Card className='h-full flex flex-col hover:shadow-lg transition-all duration-300 group border-border/50 hover:border-border'>
      {/* Cover image or placeholder */}
      <div className='aspect-video overflow-hidden bg-muted/40'>
        {post.coverImage ? (
          <OptimizedImage
            src={post.coverImage}
            alt={localized.title}
            className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
          />
        ) : (
          <div className='w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900'>
            <svg
              className='w-10 h-10 text-slate-400 dark:text-slate-500'
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
            {post.category}
          </Badge>
          <DateDisplay date={formattedDate} />
        </div>
        <CardTitle className='line-clamp-2 group-hover:text-primary transition-colors leading-tight font-extrabold'>
          <Link
            to={{ pathname: postUrl, search: search || undefined }}
            state={{ from: fromState }}
            className='hover:underline'
            onMouseEnter={() => prefetchPost(post.year, post.slug)}
            onFocus={() => prefetchPost(post.year, post.slug)}
          >
            {localized.title}
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
                <Clock className='h-3 w-3' />
                <span>{readingTimeLabel}</span>
              </div>
            )}

            {/* Author */}
            {post.author && (
              <div className='flex items-center gap-1'>
                <User className='h-3 w-3' />
                <span>{post.author}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className='w-full'>
            <TagList
              tags={post.tags}
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
            onMouseEnter={() => prefetchPost(post.year, post.slug)}
            onFocus={() => prefetchPost(post.year, post.slug)}
          >
            {readMoreLabel}
            <ArrowRight className='ml-2 h-4 w-4 transition-transform group-hover/button:translate-x-1' />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
});

BlogCard.displayName = 'BlogCard';

export default BlogCard;
