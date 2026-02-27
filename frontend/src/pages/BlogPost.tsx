import {
  useParams,
  Link,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ReadingProgress } from '@/components/common/ReadingProgress';
import { ScrollToTop } from '@/components/common/ScrollToTop';
import { getPostBySlug, getPostsPage, prefetchPost, getPostsBySeries } from '@/data/posts';
import { BlogPost as BlogPostType } from '@/types/blog';
import {
  formatDate,
  resolveLocalizedPost,
  parseDescriptionMarkdown,
} from '@/utils/blog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CommentSection, TableOfContents, TocDrawer, SeriesNavigation } from '@/components/features/blog';
import { QuizPanel } from '@/components/features/sentio/QuizPanel';
import { Breadcrumb } from '@/components/features/navigation/Breadcrumb';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Tag,
  Share2,
  BookOpen,
  User,
  Languages,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import useLanguage from '@/hooks/useLanguage';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { recordView } from '@/services/analytics';
import { translatePost, type TranslationResult } from '@/services/translate';
import { curiosityTracker } from '@/services/curiosity';
import { useUIStrings } from '@/utils/i18n/uiStrings';
import { findRelatedPosts as findRAGRelatedPosts } from '@/services/rag';

const MarkdownRenderer = lazy(
  () => import('@/components/features/blog/MarkdownRenderer')
);

type VisitedPostItem = {
  path: string;
  title: string;
  coverImage?: string;
  year: string;
  slug: string;
};

const BlogPost = () => {
  const { year, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: unknown })?.from;
  const preservedFrom =
    from && typeof from === 'object' && 'pathname' in from
      ? (from as { pathname: string; search?: string })
      : undefined;
  const preservedSearch =
    preservedFrom?.search ??
    (typeof location.search === 'string' ? location.search : '');
  const { toast } = useToast();
  const { language, setLanguage } = useLanguage();
  const { isTerminal } = useTheme();
  const str = useUIStrings();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPostType[]>([]);
  const [seriesPosts, setSeriesPosts] = useState<BlogPostType[]>([]);
  const [inlineEnabled, setInlineEnabled] = useState<boolean>(true);

  // AI Translation state
  const [translating, setTranslating] = useState(false);
  const [aiTranslation, setAiTranslation] = useState<TranslationResult | null>(null);
  const [translationError, setTranslationError] = useState<{
    message: string;
    retryable: boolean;
  } | null>(null);

  // Check if native translation exists for the selected language
  const hasNativeTranslation = useMemo(() => {
    if (!post) return false;
    const defaultLang = post.defaultLanguage || post.language || 'ko';
    if (language === defaultLang) return true;
    return !!post.translations?.[language];
  }, [post, language]);

  const localized = useMemo(() => {
    if (!post) return null;
    
    const postMatchesUrl = post.year === year && post.slug === slug;
    if (!postMatchesUrl) {
      return resolveLocalizedPost(post, language);
    }
    
    if (aiTranslation && !hasNativeTranslation) {
      return {
        title: aiTranslation.title,
        description: aiTranslation.description,
        excerpt: aiTranslation.description,
        content: aiTranslation.content,
      };
    }
    
    return resolveLocalizedPost(post, language);
  }, [post, language, aiTranslation, hasNativeTranslation, year, slug]);

  const readingTimeLabel = useMemo(() => {
    if (!post) return '';
    const raw = post.readingTime || (post.readTime ? `${post.readTime} min read` : '');
    if (!raw) return '';
    const match = raw.match(/(\d+)/);
    if (language === 'ko') {
      const minutes = match ? match[1] : '';
      if (minutes) return `${minutes}분 읽기`;
      return raw.includes('분') ? raw : raw.replace('min read', '분 읽기');
    }
    if (raw.includes('분')) {
      const minutes = match ? match[1] : '';
      if (minutes) return `${minutes} min read`;
    }
    return raw;
  }, [language, post]);

  const resolveLanguageName = useCallback((code: string) => {
    if (code === 'ko') return '한국어';
    if (code === 'en') return 'English';
    return code.toUpperCase();
  }, []);

  const safeAreaPaddingStyle = useMemo(
    () => ({ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }),
    []
  );

  const handleBackToBlog = () => {
    if (preservedFrom) {
      navigate(`${preservedFrom.pathname}${preservedFrom.search || ''}`);
    } else {
      navigate(`/blog${preservedSearch || ''}`);
    }
  };

  // Ensure scroll starts at top when navigating between posts
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [year, slug]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(false);
        // Reset translation states on route change to prevent stale content
        setAiTranslation(null);
        setTranslating(false);
        setTranslationError(null);

        if (!year || !slug) {
          setError(true);
          setLoading(false);
          return;
        }

        // Load the specific post
        const foundPost = await getPostBySlug(year, slug);

        if (!foundPost) {
          setError(true);
          setLoading(false);
          return;
        }

        setPost(foundPost);
        setLoading(false);
      } catch (err) {
        console.error('Error loading blog post:', err);
        setError(true);
        setLoading(false);
      }
    };

    loadData();
  }, [year, slug]);

  // After post loads, record it to visited posts and track view
  useEffect(() => {
    if (!post) return;

    // Record view to D1 analytics (fire and forget)
    recordView(post.year, post.slug).catch(() => {});

    // Track to Curiosity (Web of Curiosity feature)
    const postId = `${post.year}/${post.slug}`;
    const path = `/blog/${post.year}/${post.slug}`;
    curiosityTracker.trackPostView(postId, path, post.title, post.tags || []);

    // Save to local visited posts
    try {
      const key = 'visited.posts';
      const raw = localStorage.getItem(key);
      const items: VisitedPostItem[] = raw ? JSON.parse(raw) : [];
      const path = `/blog/${post.year}/${post.slug}`;
      const next: VisitedPostItem = {
        path,
        title: post.title,
        coverImage: post.coverImage,
        year: post.year,
        slug: post.slug,
      };
      const deduped = [next, ...items.filter(i => i.path !== path)].slice(
        0,
        12
      );
      localStorage.setItem(key, JSON.stringify(deduped));
      window.dispatchEvent(new CustomEvent('visitedposts:update'));
    } catch (err) {
      try {
        window.dispatchEvent(new CustomEvent('visitedposts:error'));
      } catch { void 0; }
      console.warn('Failed to persist visited posts', err);
    }
  }, [post]);

  // Auto-translate when language changes and no native translation exists
  useEffect(() => {
    if (!post || !year || !slug) return;
    
    const postMatchesUrl = post.year === year && post.slug === slug;
    if (!postMatchesUrl) {
      return;
    }
    
    const defaultLang = post.defaultLanguage || post.language || 'ko';
    
    if (language === defaultLang || post.translations?.[language]) {
      setAiTranslation(null);
      setTranslationError(null);
      return;
    }

    let cancelled = false;

    const loadTranslation = async () => {
      setTranslating(true);
      setTranslationError(null);

      try {
        const result = await translatePost({
          year,
          slug,
          targetLang: language,
          sourceLang: defaultLang,
          title: post.title,
          description: post.description,
          content: post.content,
        });

        if (!cancelled) {
          setAiTranslation(result);
        }
      } catch (err) {
        console.error('Translation failed:', err);
        if (!cancelled) {
          const errMsg = err instanceof Error ? err.message : '';
          const isTimeout = errMsg.includes('504') || errMsg.includes('응답 지연') || errMsg.includes('timeout');
          const isAiError = errMsg.includes('502') || errMsg.includes('AI 서버');
          
          setTranslationError({
            message: isTimeout 
              ? 'AI 서버 응답이 지연되고 있습니다.'
              : isAiError
                ? 'AI 번역 서버에서 오류가 발생했습니다.'
                : '번역 중 오류가 발생했습니다.',
            retryable: isTimeout || isAiError,
          });
        }
      } finally {
        if (!cancelled) {
          setTranslating(false);
        }
      }
    };

    loadTranslation();

    return () => {
      cancelled = true;
    };
  }, [post, language, year, slug]);

  useEffect(() => {
    if (!post) return;
    if (typeof document === 'undefined') return;
    const title = (post.title || '').trim();
    document.title = title || document.title;
  }, [post]);

  // sync inline feature flag from localStorage and storage events
  useEffect(() => {
    const read = () => {
      try {
        const v = localStorage.getItem('aiMemo.inline.enabled');
        setInlineEnabled(!!JSON.parse(v || 'true'));
      } catch {
        setInlineEnabled(true);
      }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'aiMemo.inline.enabled') {
        read();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', read);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', read);
    };
  }, [year, slug]);

  // Load related posts using paginated metadata without fetching all posts
  useEffect(() => {
    let cancelled = false;
    const loadRelated = async () => {
      if (!post) return;
      try {
        let selected: BlogPostType[] = [];

        try {
          const ragResults = await findRAGRelatedPosts({
            title: post.title,
            content: post.content?.slice(0, 500) || '',
            slug: post.slug,
          }, 4);
          
          if (ragResults.length >= 2) {
            const ragPostPromises = ragResults.map(async (r) => {
              const postYear = r.metadata.year as string;
              const postSlug = r.metadata.slug as string;
              if (postYear && postSlug) {
                return await getPostBySlug(postYear, postSlug);
              }
              return null;
            });
            const ragPosts = (await Promise.all(ragPostPromises)).filter(
              (p): p is BlogPostType => !!p
            );
            selected = ragPosts.slice(0, 3);
          }
        } catch {
        }

        if (selected.length < 3) {
          const byCategory = await getPostsPage({
            page: 1,
            pageSize: 6,
            category: post.category,
            sort: 'date',
          });
          const candidates = byCategory.items.filter(
            p => `${p.year}/${p.slug}` !== `${post.year}/${post.slug}` &&
              !selected.some(s => s.year === p.year && s.slug === p.slug)
          );
          selected = selected.concat(candidates).slice(0, 3);
        }

        if (selected.length < 3 && post.tags && post.tags.length) {
          const byTag = await getPostsPage({
            page: 1,
            pageSize: 6,
            search: post.tags[0],
            sort: 'date',
          });
          const more = byTag.items.filter(
            p =>
              `${p.year}/${p.slug}` !== `${post.year}/${post.slug}` &&
              !selected.some(s => s.year === p.year && s.slug === p.slug)
          );
          selected = selected.concat(more).slice(0, 3);
        }

        if (selected.length < 3) {
          const latest = await getPostsPage({
            page: 1,
            pageSize: 6,
            sort: 'date',
          });
          const more = latest.items.filter(
            p =>
              `${p.year}/${p.slug}` !== `${post.year}/${post.slug}` &&
              !selected.some(s => s.year === p.year && s.slug === p.slug)
          );
          selected = selected.concat(more).slice(0, 3);
        }

        if (!cancelled) setRelatedPosts(selected);
      } catch {
        if (!cancelled) setRelatedPosts([]);
      }
    };
    loadRelated();
    return () => {
      cancelled = true;
    };
  }, [post]);

  useEffect(() => {
    let cancelled = false;
    const loadSeriesPosts = async () => {
      if (!post?.series) {
        setSeriesPosts([]);
        return;
      }
      try {
        const posts = await getPostsBySeries(post.series);
        if (!cancelled) setSeriesPosts(posts);
      } catch {
        if (!cancelled) setSeriesPosts([]);
      }
    };
    loadSeriesPosts();
    return () => {
      cancelled = true;
    };
  }, [post?.series]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.description,
          url,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied!',
        description: 'The post URL has been copied to your clipboard.',
      });
    }
  };

  if (loading) {
    return (
      <div className='container mx-auto max-w-4xl px-4 py-12'>
        <div className='space-y-4 animate-pulse rounded-3xl border border-border/60 bg-card/60 p-6 shadow-sm'>
          <div className='h-4 w-24 rounded bg-muted'></div>
          <div className='h-10 w-3/4 rounded bg-muted'></div>
          <div className='h-4 w-1/2 rounded bg-muted'></div>
          <div className='mt-8 space-y-2'>
            <div className='h-4 rounded bg-muted'></div>
            <div className='h-4 rounded bg-muted'></div>
            <div className='h-4 w-5/6 rounded bg-muted'></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return <Navigate to='/404' replace />;
  }

  // Related posts are loaded lazily via paginated metadata

  return (
    <>
      <ReadingProgress />
      <div
        className={cn(
          'min-h-screen bg-gradient-to-b from-[#f5f6fb] via-background to-background/70 dark:from-[#04050a] dark:via-[#0b0f18] dark:to-[#111827]',
          isTerminal && 'bg-background from-background via-background to-background'
        )}
      >
        <div
          className='mx-auto w-full max-w-7xl px-4 pt-6 pb-32 sm:pt-12'
          style={safeAreaPaddingStyle}
        >
          <div className='relative flex justify-center gap-8'>
            <article
              className={cn(
                'w-full max-w-4xl space-y-12',
                isTerminal && 'terminal-card p-4 sm:p-6'
              )}
            >
            <header className='space-y-6'>
              <Breadcrumb
                items={[
                  { label: 'Blog', href: '/blog' },
                  { label: post.category, href: `/blog?category=${encodeURIComponent(post.category)}` },
                  { label: localized?.title ?? post.title },
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
                  {isTerminal ? `< ${str.blog.backToBlog}` : str.blog.backToBlog}
                </Button>
                <Button
                  onClick={handleShare}
                  variant='outline'
                  size='sm'
                  className={cn(
                    'gap-2 rounded-full border-border bg-white/70 text-foreground backdrop-blur hover:bg-primary/10 dark:border-white/10 dark:bg-white/5 dark:text-white',
                    isTerminal && 'font-mono border-border bg-transparent'
                  )}
                >
                  <Share2 className='h-4 w-4' />
                  {str.blog.share}
                </Button>
              </div>

              <div
                className={cn(
                  'rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#131a26] sm:p-8',
                  isTerminal && 'rounded-lg border-border bg-card'
                )}
              >
                <div className='space-y-5'>
                  {/* Terminal-style path indicator */}
                  {isTerminal && (
                    <div className='font-mono text-xs text-muted-foreground'>
                      <span className='text-primary'>cat</span>{' '}
                      ~/blog/{year}/{slug}.md
                    </div>
                  )}

                  <div
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary',
                      isTerminal && 'rounded font-mono tracking-wider'
                    )}
                  >
                    {isTerminal && '['}{post.category}{isTerminal && ']'}
                  </div>

                  <h1
                    className={cn(
                      'text-3xl font-bold leading-tight tracking-tight text-foreground dark:text-white sm:text-4xl lg:text-5xl',
                      isTerminal && 'font-mono terminal-glow'
                    )}
                  >
                    {isTerminal && '> '}
                    {localized?.title ?? post.title}
                  </h1>

                  {post.description && (
                    <p
                      className={cn(
                        'text-base leading-relaxed text-foreground/85 dark:text-foreground/85 sm:text-lg',
                        isTerminal && 'border-l-2 border-primary/30 pl-4'
                      )}
                      dangerouslySetInnerHTML={{
                        __html: parseDescriptionMarkdown(localized?.description ?? post.description)
                      }}
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
                        'flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 shadow-sm dark:bg-[#0f1724] dark:text-white',
                        isTerminal && 'rounded bg-[hsl(var(--terminal-code-bg))]'
                      )}
                    >
                      <Calendar className='h-4 w-4 text-foreground/70' />
                      <span>{isTerminal ? `date: ${formatDate(post.date)}` : formatDate(post.date)}</span>
                    </div>
                    {readingTimeLabel && (
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 shadow-sm dark:bg-[#0f1724] dark:text-white',
                          isTerminal && 'rounded bg-[hsl(var(--terminal-code-bg))]'
                        )}
                      >
                        <Clock className='h-4 w-4 text-foreground/70' />
                        <span>{isTerminal ? `time: ${readingTimeLabel}` : readingTimeLabel}</span>
                      </div>
                    )}
                    {post.author && (
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 shadow-sm dark:bg-[#0f1724] dark:text-white',
                          isTerminal && 'rounded bg-[hsl(var(--terminal-code-bg))]'
                        )}
                      >
                        <User className='h-4 w-4 text-foreground/70' />
                        <span>{isTerminal ? `author: ${post.author}` : post.author}</span>
                      </div>
                    )}
                  </div>

                  {/* Language Selection - Always show for translation support */}
                  <div
                    className={cn(
                      'flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-xs font-medium text-muted-foreground dark:border-primary/40 dark:bg-primary/10 dark:text-white/80',
                      isTerminal && 'rounded-lg font-mono border-solid',
                      translating && 'animate-pulse'
                    )}
                  >
                    <Languages className='h-4 w-4 text-primary' />
                    <span className='uppercase tracking-wide'>
                      {str.blog.readingLanguage}
                    </span>
                    <div className='flex flex-wrap gap-2'>
                      {(['ko', 'en'] as const).map(code => (
                        <button
                          key={code}
                          type='button'
                          onClick={() => setLanguage(code)}
                          disabled={translating}
                          className={cn(
                            'rounded-full px-3 py-1 text-sm transition-colors',
                            language === code
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-white/70 text-foreground/70 dark:bg-background/60 hover:bg-white dark:hover:bg-background/80',
                            isTerminal && 'rounded font-mono',
                            translating && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {resolveLanguageName(code)}
                        </button>
                      ))}
                    </div>
                    {/* Translation status indicators */}
                    {translating && (
                      <div className='flex items-center gap-1.5 ml-2 text-primary'>
                        <Loader2 className='h-3.5 w-3.5 animate-spin' />
                        <span className='text-xs'>
                          {str.blog.translating}
                        </span>
                      </div>
                    )}
                    {aiTranslation && !translating && !hasNativeTranslation && (
                      <div className='flex items-center gap-1.5 ml-2 text-amber-600 dark:text-amber-400'>
                        <Sparkles className='h-3.5 w-3.5' />
                        <span className='text-xs'>
                          {str.blog.aiTranslated}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Translation error message */}
                  {translationError && (
                    <div className={cn(
                      'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400',
                      isTerminal && 'font-mono'
                    )}>
                      <div className='flex items-start justify-between gap-3'>
                        <div>
                          <p className='font-medium mb-1'>
                            {str.blog.translationFailed}
                          </p>
                          <p className='text-xs opacity-80'>{translationError.message}</p>
                          <p className='text-xs mt-1 opacity-60'>
                            {str.blog.showingOriginal}
                          </p>
                        </div>
                        {translationError.retryable && (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => {
                              setTranslationError(null);
                              setAiTranslation(null);
                            }}
                            className={cn(
                              'shrink-0 text-xs h-8',
                              isTerminal && 'font-mono border-primary/40 text-primary hover:bg-primary/10'
                            )}
                          >
                            {str.common.retry}
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
                      {post.tags.map(tag => (
                        <Badge
                          key={tag}
                          variant='outline'
                          className={cn(
                            'rounded-full px-3 py-1 text-xs dark:border-white/20 dark:text-white cursor-pointer hover:bg-primary/10 transition-colors',
                            isTerminal && 'rounded border-primary/40 text-primary hover:bg-primary/20'
                          )}
                          onClick={() => {
                            curiosityTracker.trackTagClick(tag, `${post.year}/${post.slug}`);
                            navigate(`/blog?tag=${encodeURIComponent(tag)}`);
                          }}
                        >
                          {isTerminal ? `[${tag}]` : `#${tag}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </header>

            <section
              data-toc-boundary
              className={cn(
                'rounded-[32px] border border-white/50 bg-card/70 p-4 shadow-soft backdrop-blur-sm dark:border-white/5 dark:bg-[#141927]/90 sm:p-8 -mx-2 sm:mx-0',
                isTerminal && 'rounded-lg border-border bg-[hsl(var(--terminal-code-bg))]'
              )}
            >
              <div
                className={cn(
                  'prose prose-gray max-w-none dark:prose-invert',
                  isTerminal && 'prose-headings:font-mono prose-headings:terminal-glow'
                )}
              >
                <Suspense
                  fallback={
                    <div className='space-y-3' aria-label='Loading article content'>
                      <Skeleton className='h-6 w-3/4' />
                      <Skeleton className='h-4 w-full' />
                      <Skeleton className='h-4 w-11/12' />
                      <Skeleton className='h-4 w-10/12' />
                      <Skeleton className='h-4 w-9/12' />
                      <Skeleton className='h-4 w-1/2' />
                    </div>
                  }
                >
                  <MarkdownRenderer
                    content={localized?.content ?? post.content}
                    inlineEnabled={inlineEnabled}
                    postTitle={localized?.title ?? post.title}
                    postPath={`${post.year}/${post.slug}`}
                  />
                </Suspense>
              </div>
            </section>

            {post.series && seriesPosts.length > 1 && (
              <SeriesNavigation currentPost={post} seriesPosts={seriesPosts} />
            )}

            {/* AI Quiz Panel — shown only for posts with code blocks */}
            <QuizPanel
              content={localized?.content ?? post.content}
              postTitle={localized?.title ?? post.title}
              postTags={post.tags}
            />

            <CommentSection postId={`${post.year}/${post.slug}`} />

            {relatedPosts.length > 0 && (
              <section className='space-y-6'>
                <div className='flex items-center gap-3'>
                  <div
                    className={cn(
                      'rounded-full bg-secondary/20 p-2 text-secondary-foreground dark:bg-white/10 dark:text-white',
                      isTerminal && 'rounded bg-[hsl(var(--terminal-code-bg))]'
                    )}
                  >
                    <BookOpen className='h-5 w-5' />
                  </div>
                  <div>
<h2
                        className={cn(
                          'text-xl font-semibold text-foreground dark:text-white',
                          isTerminal && 'font-mono text-primary'
                        )}
                      >
                        {isTerminal ? `> ${str.blog.relatedPosts}` : str.blog.relatedPosts}
                      </h2>
                      <p
                        className={cn(
                          'text-sm text-foreground/80 dark:text-foreground/80',
                          isTerminal && 'font-mono text-xs'
                        )}
                      >
                        {str.blog.relatedPostsDesc}
                      </p>
                  </div>
                </div>
                <div className='grid gap-4 md:grid-cols-3'>
                  {relatedPosts.map(relatedPost => (
                    <Link
                      key={`${relatedPost.year}/${relatedPost.slug}`}
                      to={{
                        pathname: `/blog/${relatedPost.year}/${relatedPost.slug}`,
                        search: preservedSearch || undefined,
                      }}
                      state={
                        preservedFrom ? { from: preservedFrom } : undefined
                      }
                      className={cn(
                        'group rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg dark:border-white/10 dark:bg-[#141b2a]',
                        isTerminal && 'rounded-lg border-border bg-[hsl(var(--terminal-code-bg))] hover:border-primary'
                      )}
                      onMouseEnter={() =>
                        prefetchPost(relatedPost.year, relatedPost.slug)
                      }
                      onFocus={() =>
                        prefetchPost(relatedPost.year, relatedPost.slug)
                      }
                    >
                      <Badge
                        variant='secondary'
                        className={cn(
                          'mb-3 rounded-full px-3 py-1 text-xs dark:bg-white/10 dark:text-white',
                          isTerminal && 'rounded font-mono text-primary bg-transparent border border-primary/40'
                        )}
                      >
                        {isTerminal ? `[${relatedPost.category}]` : relatedPost.category}
                      </Badge>
                      <h3
                        className={cn(
                          'text-base font-semibold leading-snug text-foreground dark:text-white group-hover:text-primary',
                          isTerminal && 'font-mono'
                        )}
                      >
                        {relatedPost.title}
                      </h3>
                      <p className='mt-2 line-clamp-2 text-sm text-foreground/80 dark:text-foreground/80'>
                        {relatedPost.excerpt || relatedPost.description}
                      </p>
                      {(relatedPost.readingTime || relatedPost.readTime) && (
                        <p
                          className={cn(
                            'mt-3 text-xs uppercase tracking-wide text-foreground/70 dark:text-foreground/75',
                            isTerminal && 'font-mono'
                          )}
                        >
                          {relatedPost.readingTime || `${relatedPost.readTime} min read`}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>
          
          <aside className='hidden xl:block relative'>
            <TableOfContents
              content={localized?.content ?? post.content}
              postTitle={localized?.title ?? post.title}
            />
          </aside>
        </div>
        </div>
      </div>
      <ScrollToTop />
      {/* Mobile TOC floating button */}
      <TocDrawer
        content={localized?.content ?? post.content}
        postTitle={localized?.title ?? post.title}
      />
    </>
  );
};

export default BlogPost;
