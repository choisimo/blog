import type { HomeCategoryStripProps } from './home.types';
import { Link } from 'react-router-dom';
import {
  BrainCircuit,
  Code2,
  Coffee,
  Infinity,
  Network,
  TerminalSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS = [
  Code2,
  Infinity,
  BrainCircuit,
  TerminalSquare,
  Network,
  Coffee,
];

export function HomeCategoryStrip({
  categories,
  state,
  isTerminal,
}: HomeCategoryStripProps) {
  const shown = categories.slice(0, 6);

  return (
    <section className='mb-14'>
      <div className='mb-5 flex items-center justify-between gap-4'>
        <h2
          className={cn(
            'my-0 text-2xl font-bold tracking-tight text-[hsl(var(--blog-title))]',
            isTerminal && 'font-mono'
          )}
        >
          {isTerminal ? '// categories' : 'Browse Categories'}
        </h2>
        <Link
          to='/blog'
          className='inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-muted-foreground transition-[color,transform] duration-200 ease-spring hover:text-primary active:scale-[0.98] whitespace-nowrap'
        >
          전체 보기
        </Link>
      </div>

      {state === 'loading' ? (
        <div className='grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6'>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className='h-32 animate-pulse rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface-muted))]'
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
                className='group rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] px-3 py-5 text-center transition-[border-color,box-shadow,transform] duration-200 ease-spring hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--blog-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]'
              >
                <span className='mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg text-primary transition-transform duration-200 ease-spring group-hover:scale-105'>
                  <Icon className='h-7 w-7 stroke-[1.8]' />
                </span>
                <span className='block truncate text-sm font-semibold text-[hsl(var(--blog-title))]'>
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
