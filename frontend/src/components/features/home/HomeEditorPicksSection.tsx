import type { HomeEditorPicksSectionProps } from './home.types';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Clock } from 'lucide-react';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/content/blog';

export function HomeEditorPicksSection({
  posts,
  state,
  notice,
  isTerminal,
}: HomeEditorPicksSectionProps) {
  return (
    <section className='mb-14'>
      <div className='mb-5 flex items-center justify-between gap-4'>
        <div>
          <h2
            className={cn(
              'my-0 text-2xl font-bold tracking-tight text-[hsl(var(--blog-title))]',
              isTerminal && 'font-mono'
            )}
          >
            {isTerminal ? '// editor_picks' : "Editor's Picks"}
          </h2>
          {notice && (
            <p className='mt-1 text-sm text-muted-foreground'>{notice}</p>
          )}
        </div>
        <Link
          to='/blog'
          className='inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground transition-[color,transform] duration-200 ease-spring hover:text-primary active:scale-[0.98] whitespace-nowrap'
        >
          전체 보기
          <ArrowRight className='h-4 w-4' />
        </Link>
      </div>

      {state === 'loading' ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className='h-[19rem] animate-pulse rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface-muted))]'
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className='rounded-lg border border-dashed border-[hsl(var(--blog-border))] px-4 py-8 text-center text-sm text-muted-foreground'>
          추천 포스트를 준비 중입니다.
        </div>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {posts.slice(0, 4).map(post => (
            <Link
              key={`${post.year}/${post.slug}`}
              to={`/blog/${post.year}/${post.slug}`}
              className='group min-w-0 overflow-hidden rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] shadow-none transition-[border-color,box-shadow,transform] duration-200 ease-spring hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--blog-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]'
            >
              <div className='aspect-[16/9] overflow-hidden bg-[hsl(var(--blog-surface-muted))]'>
                {post.coverImage ? (
                  <OptimizedImage
                    src={post.coverImage}
                    alt={post.title}
                    className='h-full w-full object-cover transition-transform duration-300 ease-smooth group-hover:scale-[1.03]'
                  />
                ) : (
                  <div className='flex h-full w-full items-center justify-center'>
                    <BookOpen className='h-7 w-7 text-muted-foreground/50' />
                  </div>
                )}
              </div>
              <div className='space-y-3 p-4'>
                <div className='flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground'>
                  <span className='truncate rounded-md bg-secondary px-2 py-1 text-secondary-foreground'>
                    {post.category}
                  </span>
                  <span className='inline-flex items-center gap-1 whitespace-nowrap'>
                    <CalendarDays className='h-3 w-3' />
                    {formatDate(post.date)}
                  </span>
                </div>
                <h3 className='my-0 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[hsl(var(--blog-title))] transition-colors group-hover:text-primary'>
                  {post.title}
                </h3>
                {post.readingTime && (
                  <div className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
                    <Clock className='h-3 w-3' />
                    {post.readingTime}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
