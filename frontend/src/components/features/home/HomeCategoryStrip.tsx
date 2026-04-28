import type { HomeCategoryStripProps } from './home.types';
import { Link } from 'react-router-dom';
import {
  Bot,
  Boxes,
  Code2,
  Network,
  ServerCog,
  TerminalSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS = [Bot, ServerCog, TerminalSquare, Network, Code2, Boxes];

export function HomeCategoryStrip({
  categories,
  state,
  isTerminal,
}: HomeCategoryStripProps) {
  const shown = categories.slice(0, 6);

  return (
    <section className='mb-14'>
      <div className='mb-5 flex items-center justify-between gap-4'>
        <h2 className={cn('text-2xl font-bold', isTerminal && 'font-mono')}>
          {isTerminal ? '// categories' : 'Browse Categories'}
        </h2>
        <Link
          to='/blog'
          className='text-sm font-medium text-muted-foreground transition-colors hover:text-primary'
        >
          전체 보기
        </Link>
      </div>

      {state === 'loading' ? (
        <div className='grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6'>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className='h-24 animate-pulse rounded-lg border border-border/60 bg-muted/60'
            />
          ))}
        </div>
      ) : (
        <div className='grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6'>
          {shown.map((category, index) => {
            const Icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];
            return (
              <Link
                key={category.name}
                to={`/blog?category=${encodeURIComponent(category.name)}`}
                className='group rounded-lg border border-border/60 bg-card px-3 py-4 text-center transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm'
              >
                <span className='mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                  <Icon className='h-4 w-4' />
                </span>
                <span className='block truncate text-sm font-semibold'>
                  {category.name}
                </span>
                <span className='mt-1 block text-xs text-muted-foreground'>
                  {state === 'error'
                    ? '집계 오류'
                    : `${category.count.toLocaleString()} Posts`}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
