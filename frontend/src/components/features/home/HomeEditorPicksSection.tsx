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
          <h2 className={cn('text-2xl font-bold', isTerminal && 'font-mono')}>
            {isTerminal ? '// editor_picks' : "Editor's Picks"}
          </h2>
          {notice && (
            <p className='mt-1 text-sm text-muted-foreground'>{notice}</p>
          )}
        </div>
        <Link
          to='/blog'
          className='inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary'
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
              className='h-48 animate-pulse rounded-lg border border-border/60 bg-muted/60'
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className='rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground'>
          추천 포스트를 준비 중입니다.
        </div>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {posts.slice(0, 4).map(post => (
            <Link
              key={`${post.year}/${post.slug}`}
              to={`/blog/${post.year}/${post.slug}`}
              className='group min-w-0 rounded-lg border border-border/60 bg-card transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md'
            >
              <div className='aspect-[16/9] overflow-hidden rounded-t-lg bg-muted'>
                {post.coverImage ? (
                  <OptimizedImage
                    src={post.coverImage}
                    alt={post.title}
                    className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                  />
                ) : (
                  <div className='flex h-full w-full items-center justify-center'>
                    <BookOpen className='h-7 w-7 text-muted-foreground/50' />
                  </div>
                )}
              </div>
              <div className='space-y-2 p-4'>
                <div className='flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground'>
                  <span className='truncate rounded bg-secondary px-2 py-0.5 text-secondary-foreground'>
                    {post.category}
                  </span>
                  <span className='inline-flex items-center gap-1 whitespace-nowrap'>
                    <CalendarDays className='h-3 w-3' />
                    {formatDate(post.date)}
                  </span>
                </div>
                <h3 className='line-clamp-2 min-h-10 text-sm font-semibold leading-5 transition-colors group-hover:text-primary'>
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
