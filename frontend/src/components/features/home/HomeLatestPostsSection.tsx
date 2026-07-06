import type { HomeLatestPostsSectionProps } from './home.types';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock, Hash } from 'lucide-react';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/content/blog';

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const HAS_CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]/;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeHomeText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const normalized = String(value)
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeHomePathSegment(value: unknown): string | null {
  const normalized = normalizeHomeText(value);
  if (!normalized || normalized.includes('/') || normalized.includes('\\')) return null;
  try {
    const decoded = decodeURIComponent(normalized);
    if (
      !decoded.trim() ||
      decoded === '.' ||
      decoded === '..' ||
      HAS_CONTROL_TEXT_PATTERN.test(decoded) ||
      decoded.includes('/') ||
      decoded.includes('\\')
    ) {
      return null;
    }
    return encodeURIComponent(decoded.trim());
  } catch {
    return null;
  }
}

function normalizeHomeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

export function HomeLatestPostsSection({
  posts,
  tags,
  state,
  error,
  isTerminal,
}: HomeLatestPostsSectionProps) {
  const safePosts = posts.flatMap((post) => {
    const year = normalizeHomePathSegment(post.year);
    const slug = normalizeHomePathSegment(post.slug);
    if (!year || !slug || !/^\d{4}$/.test(year)) return [];
    return [{
      ...post,
      year,
      slug,
      title: normalizeHomeText(post.title, 'Untitled post'),
      category: normalizeHomeText(post.category, 'Post'),
      description: normalizeHomeText(post.description),
      readingTime: normalizeHomeText(post.readingTime),
    }];
  });
  const safeTags = tags.flatMap((tag) => {
    const name = normalizeHomeText(tag.name);
    if (!name || name.includes('/') || name.includes('\\')) return [];
    return [{ ...tag, name, count: normalizeHomeCount(tag.count) }];
  });
  const safeError = normalizeHomeText(error, '최신 글을 불러오지 못했습니다.');

  return (
    <section className='mb-14'>
      <div className='mb-5 flex items-center justify-between gap-4'>
        <h2
          className={cn(
            'my-0 text-2xl font-bold tracking-tight text-[hsl(var(--blog-title))]',
            isTerminal && 'font-mono'
          )}
        >
          {isTerminal ? '// latest_posts' : 'Latest Posts'}
        </h2>
        <Button
          asChild
          variant='ghost'
          size='sm'
          className='min-h-11 whitespace-nowrap'
        >
          <Link to='/blog'>
            전체 보기
            <ArrowRight className='ml-2 h-4 w-4' />
          </Link>
        </Button>
      </div>

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]'>
        <div className='min-w-0'>
          {state === 'error' ? (
            <div className='rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-5 text-sm text-destructive'>
              {safeError}
            </div>
          ) : state === 'loading' ? (
            <div className='space-y-3'>
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className='h-28 animate-pulse rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface-muted))]'
                />
              ))}
            </div>
          ) : (
            <div className='space-y-3'>
              {safePosts.map(post => (
                <Link
                  key={`${post.year}/${post.slug}`}
                  to={`/blog/${post.year}/${post.slug}`}
                  className='group block rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] p-3 transition-[border-color,box-shadow,transform] duration-200 ease-spring hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--blog-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]'
                >
                  <article className='grid grid-cols-[88px_minmax(0,1fr)] gap-4 sm:grid-cols-[128px_minmax(0,1fr)]'>
                    <div className='aspect-[16/11] overflow-hidden rounded-md bg-[hsl(var(--blog-surface-muted))]'>
                      {post.coverImage ? (
                        <OptimizedImage
                          src={post.coverImage}
                          alt={post.title}
                          className='h-full w-full object-cover transition-transform duration-300 ease-smooth group-hover:scale-[1.03]'
                        />
                      ) : (
                        <div className='flex h-full w-full items-center justify-center'>
                          <BookOpen className='h-6 w-6 text-muted-foreground/50' />
                        </div>
                      )}
                    </div>
                    <div className='min-w-0 self-center'>
                      <div className='mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                        <span className='rounded-md bg-secondary px-2 py-1 text-secondary-foreground'>
                          {post.category}
                        </span>
                        <span>{formatDate(post.date)}</span>
                        {post.readingTime && (
                          <span className='inline-flex items-center gap-1'>
                            <Clock className='h-3 w-3' />
                            {post.readingTime}
                          </span>
                        )}
                      </div>
                      <h3 className='my-0 line-clamp-1 text-base font-semibold text-[hsl(var(--blog-title))] transition-colors group-hover:text-primary'>
                        {post.title}
                      </h3>
                      {post.description && (
                        <p className='mt-1 line-clamp-2 text-sm text-muted-foreground'>
                          {post.description}
                        </p>
                      )}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className='rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] p-4'>
          <div className='mb-4 flex items-center gap-2'>
            <Hash className='h-4 w-4 text-primary' />
            <h3 className='my-0 text-sm font-semibold text-[hsl(var(--blog-title))]'>
              Popular Tags
            </h3>
          </div>
          {safeTags.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              태그를 준비 중입니다.
            </p>
          ) : (
            <div className='space-y-2'>
              {safeTags.slice(0, 6).map(tag => (
                <Link
                  key={tag.name}
                  to={`/blog?tag=${encodeURIComponent(tag.name)}`}
                  className='flex min-h-11 items-center justify-between rounded-md border border-[hsl(var(--blog-border))] px-3 py-2 text-sm transition-[border-color,color,transform] duration-200 ease-spring hover:border-primary/40 hover:text-primary active:scale-[0.99]'
                >
                  <span className='truncate'>#{tag.name}</span>
                  <span className='ml-3 font-mono text-xs text-muted-foreground'>
                    {tag.count}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
