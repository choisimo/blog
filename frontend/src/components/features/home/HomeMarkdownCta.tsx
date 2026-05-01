import type { HomeMarkdownCtaProps } from './home.types';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageSquareText, Sparkles } from 'lucide-react';
import { SafeDescriptionMarkdown } from '@/components/features/blog/SafeDescriptionMarkdown';
import { DEFAULT_HOME_AI_CTA_BLOCK } from '@/services/content/site-content';
import { cn } from '@/lib/utils';

function isExternalHref(href: string): boolean {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:')
  );
}

export function HomeMarkdownCta({
  block,
  state,
  isTerminal,
}: HomeMarkdownCtaProps) {
  const content = block ?? DEFAULT_HOME_AI_CTA_BLOCK;
  if (!content.enabled) return null;

  const ctaHref = content.ctaHref || DEFAULT_HOME_AI_CTA_BLOCK.ctaHref;
  const ctaLabel = content.ctaLabel || DEFAULT_HOME_AI_CTA_BLOCK.ctaLabel;

  return (
    <section
      className={cn(
        'mb-6 overflow-hidden rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))]',
        isTerminal && 'border-primary/30'
      )}
    >
      <div className='grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_220px] md:p-6'>
        <div className='min-w-0 self-center'>
          {state === 'loading' && !block ? (
            <div className='space-y-3'>
              <div className='h-5 w-52 animate-pulse rounded bg-muted' />
              <div className='h-4 w-full max-w-xl animate-pulse rounded bg-muted' />
            </div>
          ) : (
            <SafeDescriptionMarkdown
              text={content.markdown}
              className='max-w-2xl text-sm leading-7 text-muted-foreground [&_strong]:text-foreground'
            />
          )}
          {ctaHref && ctaLabel && (
            <div className='mt-4'>
              {isExternalHref(ctaHref) ? (
                <a
                  href={ctaHref}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-200 ease-spring hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]'
                >
                  {ctaLabel}
                  <ArrowRight className='h-4 w-4' />
                </a>
              ) : (
                <Link
                  to={ctaHref}
                  className='inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-200 ease-spring hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]'
                >
                  {ctaLabel}
                  <ArrowRight className='h-4 w-4' />
                </Link>
              )}
            </div>
          )}
        </div>

        <div className='hidden min-h-28 rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-page))] p-3 md:block'>
          <div className='mb-3 flex items-center justify-between'>
            <div className='flex items-center gap-2 text-xs font-semibold'>
              <span className='flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary'>
                <Sparkles className='h-3.5 w-3.5' />
              </span>
              AI Chat
            </div>
            <MessageSquareText className='h-4 w-4 text-muted-foreground' />
          </div>
          <div className='space-y-2'>
            <div className='h-6 w-4/5 rounded-md bg-muted' />
            <div className='ml-auto h-6 w-3/5 rounded-md bg-primary/15' />
            <div className='h-6 w-2/3 rounded-md bg-muted' />
          </div>
        </div>
      </div>
    </section>
  );
}
