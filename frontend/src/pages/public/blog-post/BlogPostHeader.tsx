import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/features/navigation/Breadcrumb';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Tag,
  Share2,
  User,
  Languages,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { curiosityTracker } from '@/services/engagement/curiosity';
import { formatDate } from '@/utils/content/blog';
import type {
  BlogPost as BlogPostType,
  ResolvedPostViewModel,
  SupportedLanguage,
} from '@/types/blog';
import type { TranslationResult } from '@/services/content/translate';
import { SafeDescriptionMarkdown } from '@/components/features/blog/SafeDescriptionMarkdown';
import type { AsyncArtifactStatus } from '@/components/features/sentio/hooks/useAsyncArtifact';

interface BlogPostHeaderProps {
  post: BlogPostType;
  postView: ResolvedPostViewModel;
  year: string;
  slug: string;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  availableLanguages: SupportedLanguage[];
  resolveLanguageName: (code: string) => string;
  translationStatus: AsyncArtifactStatus;
  aiTranslation: TranslationResult | null;
  hasNativeTranslation: boolean;
  translationError: { message: string; retryable: boolean } | null;
  onRetryTranslation: () => void;
  isTerminal: boolean;
  preservedFrom?: { pathname: string; search?: string };
  preservedSearch: string;
  onShare: () => void;
  // UI strings
  backToBlogLabel: string;
  shareLabel: string;
  readingLanguageLabel: string;
  translatingLabel: string;
  aiTranslatedLabel: string;
  translationFailedLabel: string;
  showingOriginalLabel: string;
  retryLabel: string;
}

export function BlogPostHeader({
  post,
  postView,
  year,
  slug,
  language,
  setLanguage,
  availableLanguages,
  resolveLanguageName,
  translationStatus,
  aiTranslation,
  hasNativeTranslation,
  translationError,
  onRetryTranslation,
  isTerminal,
  preservedFrom,
  preservedSearch,
  onShare,
  backToBlogLabel,
  shareLabel,
  readingLanguageLabel,
  translatingLabel,
  aiTranslatedLabel,
  translationFailedLabel,
  showingOriginalLabel,
  retryLabel,
}: BlogPostHeaderProps) {
  const navigate = useNavigate();
  const description = postView.description;
  const isTranslationWarming = translationStatus === 'warming';
  const hasAiTranslationReady =
    translationStatus === 'ready' && aiTranslation && !hasNativeTranslation;
  const formattedDate = formatDate(
    postView.date,
    language === 'en' ? 'en' : 'ko'
  );

  const handleBackToBlog = () => {
    if (preservedFrom) {
      navigate(`${preservedFrom.pathname}${preservedFrom.search || ''}`);
    } else {
      navigate(`/blog${preservedSearch || ''}`);
    }
  };

  return (
    <header className='space-y-6'>
      <Breadcrumb
        items={[
          { label: 'Blog', href: '/blog' },
          {
            label: postView.categoryLabel,
            href: `/blog?category=${encodeURIComponent(post.category)}`,
          },
          { label: postView.title },
        ]}
        className={cn(isTerminal && 'font-mono text-xs')}
      />
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Button
          variant='ghost'
          onClick={handleBackToBlog}
          className={cn(
            'hover:bg-primary/10 dark:text-white',
            isTerminal && 'font-mono text-primary hover:text-primary'
          )}
          size='sm'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          {isTerminal ? `< ${backToBlogLabel}` : backToBlogLabel}
        </Button>
        <Button
          onClick={onShare}
          variant='outline'
          size='sm'
          className={cn(
            'gap-2 rounded-full border-border bg-white/70 text-foreground backdrop-blur hover:bg-primary/10 dark:border-white/10 dark:bg-white/5 dark:text-white',
            isTerminal && 'font-mono border-border bg-transparent'
          )}
        >
          <Share2 className='h-4 w-4' />
          {shareLabel}
        </Button>
      </div>

      <div
        className={cn(
          'rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[hsl(var(--card-blog))] sm:p-8',
          isTerminal && 'rounded-lg border-border bg-card'
        )}
      >
        <div className='space-y-5'>
          {/* Terminal-style path indicator */}
          {isTerminal && (
            <div className='font-mono text-xs text-muted-foreground'>
              <span className='text-primary'>cat</span> ~/blog/{year}/{slug}.md
            </div>
          )}

          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary',
              isTerminal && 'rounded font-mono tracking-wider'
            )}
          >
            {isTerminal && '['}
            {postView.categoryLabel}
            {isTerminal && ']'}
          </div>

          <h1
            className={cn(
              'text-3xl font-bold leading-tight tracking-tight text-foreground dark:text-white sm:text-4xl lg:text-5xl',
              isTerminal && 'font-mono terminal-glow'
            )}
          >
            {isTerminal && '> '}
            {postView.title}
          </h1>

          {description && (
            <SafeDescriptionMarkdown
              text={description}
              className={cn(
                'text-base leading-relaxed text-foreground/85 dark:text-foreground/85 sm:text-lg',
                isTerminal && 'border-l-2 border-primary/30 pl-4'
              )}
            />
          )}

          <div
            className={cn(
              'grid gap-3 text-sm text-muted-foreground sm:grid-cols-3',
              isTerminal && 'font-mono text-xs'
            )}
          >
            <div
              className={cn(
                'flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 shadow-sm dark:bg-[hsl(var(--card-blog))] dark:text-white',
                isTerminal && 'rounded bg-[hsl(var(--terminal-code-bg))]'
              )}
            >
              <Calendar className='h-4 w-4 text-foreground/70' />
              <span>
                {isTerminal ? `date: ${formattedDate}` : formattedDate}
              </span>
            </div>
            {postView.readingTimeLabel && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 shadow-sm dark:bg-[hsl(var(--card-blog))] dark:text-white',
                  isTerminal && 'rounded bg-[hsl(var(--terminal-code-bg))]'
                )}
              >
                <Clock className='h-4 w-4 text-foreground/70' />
                <span>
                  {isTerminal
                    ? `time: ${postView.readingTimeLabel}`
                    : postView.readingTimeLabel}
                </span>
              </div>
            )}
            {postView.author && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 shadow-sm dark:bg-[hsl(var(--card-blog))] dark:text-white',
                  isTerminal && 'rounded bg-[hsl(var(--terminal-code-bg))]'
                )}
              >
                <User className='h-4 w-4 text-foreground/70' />
                <span>
                  {isTerminal ? `author: ${postView.author}` : postView.author}
                </span>
              </div>
            )}
          </div>

          {/* Language Selection */}
          <div
            className={cn(
              'flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-xs font-medium text-muted-foreground dark:border-primary/40 dark:bg-primary/10 dark:text-white/80',
              isTerminal && 'rounded-lg font-mono border-solid',
              isTranslationWarming && 'animate-pulse'
            )}
          >
            <Languages className='h-4 w-4 text-primary' />
            <span className='uppercase tracking-wide'>
              {readingLanguageLabel}
            </span>
            <div className='flex flex-wrap gap-2'>
              {availableLanguages.map(code => (
                <button
                  key={code}
                  type='button'
                  onClick={() => setLanguage(code)}
                  disabled={isTranslationWarming}
                  className={cn(
                    'rounded-full px-3 py-1 text-sm transition-colors',
                    language === code
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-white/70 text-foreground/70 dark:bg-background/60 hover:bg-white dark:hover:bg-background/80',
                    isTerminal && 'rounded font-mono',
                    isTranslationWarming && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {resolveLanguageName(code)}
                </button>
              ))}
            </div>
            {/* Translation status indicators */}
            {isTranslationWarming && (
              <div className='flex items-center gap-1.5 ml-2 text-primary'>
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                <span className='text-xs'>{translatingLabel}</span>
              </div>
            )}
            {hasAiTranslationReady && (
              <div className='flex items-center gap-1.5 ml-2 text-amber-600 dark:text-amber-400'>
                <Sparkles className='h-3.5 w-3.5' />
                <span className='text-xs'>{aiTranslatedLabel}</span>
              </div>
            )}
          </div>

          {/* Translation error message */}
          {translationError && (
            <div
              className={cn(
                'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400',
                isTerminal && 'font-mono'
              )}
            >
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <p className='font-medium mb-1'>{translationFailedLabel}</p>
                  <p className='text-xs opacity-80'>
                    {translationError.message}
                  </p>
                  <p className='text-xs mt-1 opacity-60'>
                    {showingOriginalLabel}
                  </p>
                </div>
                {translationError.retryable && (
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={onRetryTranslation}
                    className={cn(
                      'shrink-0 text-xs h-8',
                      isTerminal &&
                        'font-mono border-primary/40 text-primary hover:bg-primary/10'
                    )}
                  >
                    {retryLabel}
                  </Button>
                )}
              </div>
            </div>
          )}

          {post.tags && post.tags.length > 0 && (
            <div
              className={cn(
                'flex flex-wrap items-center gap-2 text-foreground/80 dark:text-foreground/80',
                isTerminal && 'font-mono text-xs'
              )}
            >
              <Tag className='h-4 w-4 text-foreground/75 dark:text-foreground/75' />
              {isTerminal && <span className='text-primary'>tags:</span>}
              {post.tags.map((tag, index) => (
                <Badge
                  key={tag}
                  variant='outline'
                  className={cn(
                    'rounded-full px-3 py-1 text-xs dark:border-white/20 dark:text-white cursor-pointer hover:bg-primary/10 transition-colors',
                    isTerminal &&
                      'rounded border-primary/40 text-primary hover:bg-primary/20'
                  )}
                  onClick={() => {
                    curiosityTracker.trackTagClick(
                      tag,
                      `${post.year}/${post.slug}`
                    );
                    navigate(`/blog?tag=${encodeURIComponent(tag)}`);
                  }}
                >
                  {isTerminal
                    ? `[${postView.tagLabels[index] ?? tag}]`
                    : `#${postView.tagLabels[index] ?? tag}`}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
