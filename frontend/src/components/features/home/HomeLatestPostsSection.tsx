import type { HomeLatestPostsSectionProps } from './home.types';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock, Hash } from 'lucide-react';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/content/blog';

export function HomeLatestPostsSection({
  posts,
  tags,
  state,
  error,
  isTerminal,
}: HomeLatestPostsSectionProps) {
  return (
    <section className='mb-14'>
      <div className='mb-5 flex items-center justify-between gap-4'>
        <h2 className={cn('text-2xl font-bold', isTerminal && 'font-mono')}>
          {isTerminal ? '// latest_posts' : 'Latest Posts'}
        </h2>
        <Button asChild variant='ghost' size='sm'>
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
              {error || '최신 글을 불러오지 못했습니다.'}
            </div>
          ) : state === 'loading' ? (
            <div className='space-y-3'>
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className='h-28 animate-pulse rounded-lg border border-border/60 bg-muted/60'
                />
              ))}
            </div>
          ) : (
            <div className='space-y-3'>
              {posts.map(post => (
                <Link
                  key={`${post.year}/${post.slug}`}
                  to={`/blog/${post.year}/${post.slug}`}
                  className='group block rounded-lg border border-border/60 bg-card p-3 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm'
                >
                  <article className='grid grid-cols-[88px_minmax(0,1fr)] gap-4 sm:grid-cols-[128px_minmax(0,1fr)]'>
                    <div className='aspect-[16/11] overflow-hidden rounded-md bg-muted'>
                      {post.coverImage ? (
                        <OptimizedImage
                          src={post.coverImage}
                          alt={post.title}
                          className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                        />
                      ) : (
                        <div className='flex h-full w-full items-center justify-center'>
                          <BookOpen className='h-6 w-6 text-muted-foreground/50' />
                        </div>
                      )}
                    </div>
                    <div className='min-w-0 self-center'>
                      <div className='mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                        <span className='rounded bg-secondary px-2 py-0.5 text-secondary-foreground'>
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
                      <h3 className='line-clamp-1 text-base font-semibold transition-colors group-hover:text-primary'>
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

        <aside className='rounded-lg border border-border/60 bg-card p-4'>
          <div className='mb-4 flex items-center gap-2'>
            <Hash className='h-4 w-4 text-primary' />
            <h3 className='text-sm font-semibold'>Popular Tags</h3>
          </div>
          {tags.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              태그를 준비 중입니다.
            </p>
          ) : (
            <div className='space-y-2'>
              {tags.slice(0, 6).map(tag => (
                <Link
                  key={tag.name}
                  to={`/blog?tag=${encodeURIComponent(tag.name)}`}
                  className='flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:text-primary'
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
