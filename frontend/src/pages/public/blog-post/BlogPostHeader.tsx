import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
import { ArticleReadingTools } from './ArticleReadingTools';
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

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const HAS_CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]/;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeHeaderText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const normalized = String(value)
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeHeaderPathSegment(value: unknown): string | null {
  const normalized = normalizeHeaderText(value);
  if (!normalized || normalized.includes('/') || normalized.includes('\\')) {
    return null;
  }
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

function normalizeHeaderQueryValue(value: unknown): string | null {
  const normalized = normalizeHeaderText(value);
  return normalized ? encodeURIComponent(normalized) : null;
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
  const safeYear =
    normalizeHeaderPathSegment(year) ??
    normalizeHeaderPathSegment(post.year) ??
    'post';
  const safeSlug =
    normalizeHeaderPathSegment(slug) ??
    normalizeHeaderPathSegment(post.slug) ??
    'untitled';
  const safeCategoryLabel = normalizeHeaderText(postView.categoryLabel, 'Post');
  const safeCategoryQuery = normalizeHeaderQueryValue(post.category);
  const safeTitle = normalizeHeaderText(postView.title, 'Untitled post');
  const safeAuthor = normalizeHeaderText(postView.author);
  const safeReadingTimeLabel = normalizeHeaderText(postView.readingTimeLabel);
  const safeTranslationErrorMessage = normalizeHeaderText(
    translationError?.message
  );
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
    <header className='ui-article-header fn-post-title-block rd-article-head'>
      <Breadcrumb
        items={[
          { label: 'Blog', href: '/blog' },
          {
            label: safeCategoryLabel,
            href: safeCategoryQuery
              ? `/blog?category=${safeCategoryQuery}`
              : '/blog',
          },
          { label: safeTitle },
        ]}
        className={cn('rd-crumbs', isTerminal && 'font-mono text-xs')}
      />
      <div className='ui-article-header__navigation rd-back'>
        <Button
          data-ui-variant='ghost'
          variant='ghost'
          onClick={handleBackToBlog}
          className={[
            'ui-control',
            cn(
              'hover:bg-primary/10 dark:text-white',
              isTerminal && 'font-mono text-primary hover:text-primary'
            ),
          ]
            .filter(Boolean)
            .join(' ')}
          size='sm'
        >
          <ArrowLeft aria-hidden='true' className='mr-2 h-4 w-4' />
          {isTerminal ? `< ${backToBlogLabel}` : backToBlogLabel}
        </Button>
      </div>

      <div className='ui-article-header__intro'>
        <div className='ui-article-header__copy'>
          {/* Terminal-style path indicator */}
          {isTerminal && (
            <div className='font-mono text-xs text-muted-foreground'>
              <span className='text-primary'>cat</span> ~/blog/{safeYear}/
              {safeSlug}.md
            </div>
          )}

          <div
            className={cn(
              'ui-article-category rd-topic',
              isTerminal && 'rounded font-mono tracking-wider'
            )}
          >
            {isTerminal && '['}
            {safeCategoryLabel}
            {isTerminal && ']'}
          </div>

          <h1
            className={cn(
              'ui-article-title fn-display-title rd-title',
              isTerminal && 'font-mono terminal-glow'
            )}
          >
            {isTerminal && '> '}
            {safeTitle}
          </h1>

          {description && (
            <SafeDescriptionMarkdown
              text={description}
              className={cn(
                'ui-article-description rd-description',
                isTerminal && 'border-l-2 border-primary/30 pl-4'
              )}
            />
          )}

          <div
            className={cn(
              'ui-article-meta fn-post-meta rd-byline',
              isTerminal && 'font-mono text-xs'
            )}
          >
            {!isTerminal && (
              <span className='rd-monogram' aria-hidden='true'>
                {safeAuthor ? safeAuthor.charAt(0) : 'n'}
              </span>
            )}
            <div className='ui-article-meta__item'>
              <Calendar
                aria-hidden='true'
                className='h-4 w-4 text-foreground/70'
              />
              <span>
                {isTerminal ? `date: ${formattedDate}` : formattedDate}
              </span>
            </div>
            {safeReadingTimeLabel && (
              <div className='ui-article-meta__item'>
                <Clock
                  aria-hidden='true'
                  className='h-4 w-4 text-foreground/70'
                />
                <span>
                  {isTerminal
                    ? `time: ${safeReadingTimeLabel}`
                    : safeReadingTimeLabel}
                </span>
              </div>
            )}
            {safeAuthor && (
              <div className='ui-article-meta__item'>
                <User
                  aria-hidden='true'
                  className='h-4 w-4 text-foreground/70'
                />
                <span>{isTerminal ? `author: ${safeAuthor}` : safeAuthor}</span>
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
                    {safeTranslationErrorMessage}
                  </p>
                  <p className='text-xs mt-1 opacity-60'>
                    {showingOriginalLabel}
                  </p>
                </div>
                {translationError.retryable && (
                  <Button
                    data-ui-variant='outline'
                    size='sm'
                    onClick={onRetryTranslation}
                    className={[
                      'ui-control',
                      cn(
                        'shrink-0 text-xs h-8',
                        isTerminal &&
                          'font-mono border-primary/40 text-primary hover:bg-primary/10'
                      ),
                    ]
                      .filter(Boolean)
                      .join(' ')}
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
                'rd-tags flex flex-wrap items-center gap-2 text-foreground/80 dark:text-foreground/80',
                isTerminal && 'font-mono text-xs'
              )}
            >
              <Tag
                aria-hidden='true'
                className='h-4 w-4 text-foreground/75 dark:text-foreground/75'
              />
              {isTerminal && <span className='text-primary'>tags:</span>}
              {post.tags.flatMap((tag, index) => {
                const safeTag = normalizeHeaderText(tag);
                const safeTagQuery = normalizeHeaderQueryValue(tag);
                if (!safeTag || !safeTagQuery) return [];
                const safeTagLabel = normalizeHeaderText(
                  postView.tagLabels[index],
                  safeTag,
                );
                return [
                  <button
                    type='button'
                    key={`${safeTag}-${index}`}
                    className={cn(
                      'rd-chip rounded-full px-3 py-1 text-xs dark:border-ui-line dark:text-white cursor-pointer hover:bg-primary/10',
                      isTerminal &&
                        'rounded border-primary/40 text-primary hover:bg-primary/20'
                    )}
                    onClick={() => {
                      curiosityTracker.trackTagClick(
                        safeTag,
                        `${safeYear}/${safeSlug}`
                      );
                      navigate(`/blog?tag=${safeTagQuery}`);
                    }}
                  >
                    {isTerminal ? `[${safeTagLabel}]` : `#${safeTagLabel}`}
                  </button>,
                ];
              })}
            </div>
          )}
          <div className='rd-toolbar'>
            {!isTerminal && (
              <button
                type='button'
                className='rd-reading-settings'
                aria-label={
                  language === 'ko' ? '읽기 설정' : 'Reading settings'
                }
                onClick={() =>
                  window.dispatchEvent(new Event('fieldnotes:reading-settings'))
                }
              >
                <span aria-hidden='true'>Aa</span>
              </button>
            )}
            {/* Language Selection */}
            <div className='ui-article-language fn-language-strip'>
              <Languages aria-hidden='true' className='h-4 w-4 text-primary' />
              <span className='sr-only'>{readingLanguageLabel}</span>
              <div
                className='ui-article-language__options'
                role='group'
                aria-label={readingLanguageLabel}
              >
                {availableLanguages.map(code => (
                  <button
                    key={code}
                    type='button'
                    onClick={() => setLanguage(code)}
                    disabled={isTranslationWarming}
                    aria-pressed={language === code}
                    className='ui-article-language__option'
                  >
                    {resolveLanguageName(code)}
                  </button>
                ))}
              </div>
              {/* Translation status indicators */}
              {isTranslationWarming && (
                <div className='flex items-center gap-1.5 ml-2 text-primary'>
                  <Loader2
                    aria-hidden='true'
                    className='h-3.5 w-3.5 animate-spin'
                  />
                  <span className='text-xs'>{translatingLabel}</span>
                </div>
              )}
              {hasAiTranslationReady && (
                <div className='flex items-center gap-1.5 ml-2 text-amber-600 dark:text-amber-400'>
                  <Sparkles aria-hidden='true' className='h-3.5 w-3.5' />
                  <span className='text-xs'>{aiTranslatedLabel}</span>
                </div>
              )}
            </div>

            {!isTerminal && <ArticleReadingTools key={`${safeYear}/${safeSlug}:${language}`} postId={`${safeYear}/${safeSlug}`} title={safeTitle} content={postView.content} onShare={onShare} />}
            {isTerminal && <Button
              data-ui-variant='outline'
              onClick={onShare}
              variant='outline'
              size='sm'
              className={[
                'ui-control',
                cn(
                  'gap-2 rounded-full border-border bg-ui-surface/70 text-foreground hover:bg-primary/10 dark:border-ui-line dark:bg-ui-surface/5 dark:text-white',
                  isTerminal && 'font-mono border-border bg-transparent'
                ),
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Share2 aria-hidden='true' className='h-4 w-4' />
              {shareLabel}
            </Button>}
          </div>
        </div>
      </div>
    </header>
  );
}
