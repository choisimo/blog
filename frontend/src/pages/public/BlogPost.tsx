import { useParams, Navigate, useLocation } from 'react-router-dom';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ReadingProgress } from '@/components/common/ReadingProgress';
import {
  getPostBySlug,
  getPostsPage,
  getPostsBySeries,
} from '@/data/content/posts';
import {
  BlogPost as BlogPostType,
  type ResolvedPostViewModel,
  type ResolvedRelatedPostCard,
  type SupportedLanguage,
} from '@/types/blog';
import {
  formatReadingTimeLabel,
  getAvailableLanguages,
  resolveLocalizedPost,
} from '@/utils/content/blog';
import {
  CommentSection,
  SeriesNavigation,
} from '@/components/features/blog';
import { QuizPanel } from '@/components/features/sentio/QuizPanel';
import { useToast } from '@/components/ui/use-toast';
import useLanguage from '@/hooks/i18n/useLanguage';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { recordView } from '@/services/content/analytics';
import {
  getCachedTranslation,
  TranslationApiError,
  type TranslationErrorCode,
  type TranslationResult,
} from '@/services/content/translate';
import { curiosityTracker } from '@/services/engagement/curiosity';
import { useUIStrings } from '@/utils/i18n/uiStrings';
import { findRelatedPosts as findRAGRelatedPosts } from '@/services/discovery/rag';
import { useSEO } from '@/hooks/seo/useSEO';
import { generateSEOData, generateStructuredData } from '@/utils/seo/seo';
import type { AsyncArtifactStatus } from '@/components/features/sentio/hooks/useAsyncArtifact';
import { BlogPostHeader } from './blog-post/BlogPostHeader';
import { BlogPostContent } from './blog-post/BlogPostContent';
import { BlogPostRelated } from './blog-post/BlogPostRelated';
import { ArticleQuickActions } from './blog-post/ArticleQuickActions';

type VisitedPostItem = {
  path: string;
  title: string;
  coverImage?: string;
  year: string;
  slug: string;
};

type TranslationErrorState = {
  code: TranslationErrorCode;
  retryable: boolean;
};

const simulatorExistenceCache = new Map<string, boolean>();

function buildSimulatorCandidate(year: string, slug: string): string {
  return encodeURI(`/posts/${year}/${slug}-simulator.html`);
}

function isAppShellHtml(content: string): boolean {
  const sample = content.slice(0, 12000).toLowerCase();
  return (
    sample.includes('<div id="root"></div>') ||
    sample.includes("<div id='root'></div>") ||
    sample.includes('script type="module" crossorigin src="/assets/index-') ||
    sample.includes('<title>nodove blog</title>')
  );
}

async function checkSimulatorExists(path: string): Promise<boolean> {
  if (simulatorExistenceCache.has(path)) {
    return simulatorExistenceCache.get(path)!;
  }

  let exists = false;

  try {
    const res = await fetch(path, { method: 'GET', cache: 'no-store' });
    if (res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) {
        const html = await res.text();
        exists = !isAppShellHtml(html);
      } else {
        exists = true;
      }
    }
  } catch {
    exists = false;
  }

  simulatorExistenceCache.set(path, exists);
  return exists;
}

const MemoizedBlogPostContent = memo(
  BlogPostContent,
  (prev, next) =>
    prev.content === next.content &&
    prev.inlineEnabled === next.inlineEnabled &&
    prev.postTitle === next.postTitle &&
    prev.postPath === next.postPath &&
    prev.isTerminal === next.isTerminal
);

const MemoizedSeriesNavigation = memo(
  SeriesNavigation,
  (prev, next) =>
    prev.currentPost === next.currentPost &&
    prev.seriesPosts === next.seriesPosts
);

const MemoizedQuizPanel = memo(
  QuizPanel,
  (prev, next) =>
    prev.content === next.content &&
    prev.postTitle === next.postTitle &&
    prev.postTags === next.postTags
);

const MemoizedCommentSection = memo(
  CommentSection,
  (prev, next) => prev.postId === next.postId
);

const MemoizedBlogPostRelated = memo(
  BlogPostRelated,
  (prev, next) =>
    prev.relatedPosts === next.relatedPosts &&
    prev.preservedSearch === next.preservedSearch &&
    prev.preservedFrom?.pathname === next.preservedFrom?.pathname &&
    prev.preservedFrom?.search === next.preservedFrom?.search &&
    prev.isTerminal === next.isTerminal &&
    prev.relatedPostsLabel === next.relatedPostsLabel &&
    prev.relatedPostsDescLabel === next.relatedPostsDescLabel
);

const BlogPost = () => {
  const { year, slug } = useParams();
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
  const [autoSimulatorSrc, setAutoSimulatorSrc] = useState<string | null>(null);

  // AI Translation state
  const [translationStatus, setTranslationStatus] =
    useState<AsyncArtifactStatus>('idle');
  const [aiTranslation, setAiTranslation] = useState<TranslationResult | null>(
    null
  );
  const [translationError, setTranslationError] =
    useState<TranslationErrorState | null>(null);
  const [translationRetryNonce, setTranslationRetryNonce] = useState(0);

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

  const contentForRender = useMemo(() => {
    if (!post) return '';

    const baseContent = localized?.content ?? post.content;
    if (!autoSimulatorSrc) return baseContent;
    if (/<iframe[\s\S]*?>/i.test(baseContent)) return baseContent;

    const heading =
      language === 'ko'
        ? '## 인터랙티브 시뮬레이터'
        : '## Interactive Simulator';
    const description =
      language === 'ko'
        ? '아래에서 알고리즘 동작을 직접 실행해볼 수 있습니다.'
        : 'Run the interactive simulation below.';
    const rawTitle = `${localized?.title ?? post.title} simulator`;
    const safeTitle = rawTitle.replace(/"/g, '&quot;');

    return `${baseContent.trimEnd()}

---

${heading}

${description}

<iframe src="${autoSimulatorSrc}" width="100%" height="760" style="border: none; border-radius: 16px; background: #0b1020;" title="${safeTitle}" loading="lazy"></iframe>
`;
  }, [autoSimulatorSrc, language, localized?.content, localized?.title, post]);

  const readingTimeLabel = useMemo(() => {
    return formatReadingTimeLabel(
      post?.readingTime ?? post?.readTime,
      language === 'en' ? 'en' : 'ko'
    );
  }, [language, post]);

  const resolvedPost = useMemo<ResolvedPostViewModel | null>(() => {
    if (!post) return null;

    const description = localized?.description ?? post.description;

    return {
      year: post.year,
      slug: post.slug,
      title: localized?.title ?? post.title,
      description,
      excerpt: localized?.excerpt ?? post.excerpt ?? description,
      content: localized?.content ?? post.content,
      categoryLabel: post.category,
      tagLabels: [...post.tags],
      readingTimeLabel,
      author: post.author,
      date: post.date,
      tags: [...post.tags],
    };
  }, [localized, post, readingTimeLabel]);

  const resolvedRelatedPosts = useMemo<ResolvedRelatedPostCard[]>(() => {
    return relatedPosts.map(relatedPost => {
      const localizedRelated = resolveLocalizedPost(relatedPost, language);

      return {
        year: relatedPost.year,
        slug: relatedPost.slug,
        title: localizedRelated.title,
        excerpt:
          localizedRelated.excerpt ||
          localizedRelated.description ||
          relatedPost.description,
        categoryLabel: relatedPost.category,
        readingTimeLabel: formatReadingTimeLabel(
          relatedPost.readingTime ?? relatedPost.readTime,
          language === 'en' ? 'en' : 'ko'
        ),
      };
    });
  }, [language, relatedPosts]);

  const seoPost = useMemo(() => {
    if (!post || !resolvedPost) return undefined;

    return {
      ...post,
      title: resolvedPost.title,
      description: resolvedPost.description,
    };
  }, [post, resolvedPost]);

  const seoData = seoPost
    ? generateSEOData(seoPost, 'post')
    : generateSEOData(undefined, 'home');
  const structuredData = seoPost
    ? generateStructuredData(seoPost, 'post')
    : undefined;
  useSEO(seoData, structuredData);

  const resolveLanguageName = useCallback((code: string) => {
    if (code === 'ko') return '한국어';
    if (code === 'en') return 'English';
    return code.toUpperCase();
  }, []);

  const languageOptions = useMemo<SupportedLanguage[]>(() => {
    if (!post) return ['ko', 'en'];
    return Array.from(new Set([...getAvailableLanguages(post), 'ko', 'en']));
  }, [post]);

  const safeAreaPaddingStyle = useMemo(
    () => ({ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }),
    []
  );

  const postId = post ? `${post.year}/${post.slug}` : '';

  const getTranslationErrorMessage = useCallback(
    (code: TranslationErrorCode) => {
      switch (code) {
        case 'NOT_AVAILABLE':
          return str.blog.translationNotAvailable;
        case 'AUTH_REQUIRED':
          return str.blog.translationAuthRequired;
        case 'AI_TIMEOUT':
          return str.blog.translationTimeout;
        case 'AI_ERROR':
          return str.blog.translationServerError;
        default:
          return str.blog.translationUnknownError;
      }
    },
    [str]
  );

  // Ensure scroll starts at top when navigating between posts
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [year, slug]);

  // Blog post pages have enough horizontal room on desktop to dock the memo panel
  // as a right-side rail instead of overlapping the article. The web component
  // falls back to its existing floating/bottom-sheet layout on narrower screens.
  useEffect(() => {
    if (!post) return;
    window.dispatchEvent(
      new CustomEvent('aiMemo:desktopLayout', {
        detail: { mode: 'rail', postId: `${post.year}/${post.slug}` },
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('aiMemo:desktopLayout', { detail: { mode: 'float' } })
      );
    };
  }, [post]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(false);
        // Reset translation states on route change to prevent stale content
        setAiTranslation(null);
        setTranslationStatus('idle');
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

  // After post loads, record it to visited posts, track view, and fan out
  // post-dependent async work in parallel.
  useEffect(() => {
    if (!post) return;

    let cancelled = false;

    // Record view and curiosity tracking are non-critical — defer off the
    // render-commit path so the post shell paints first.
    const deferredAnalyticsId = setTimeout(() => {
      recordView(post.year, post.slug).catch(() => {});
      const postId = `${post.year}/${post.slug}`;
      const path = `/blog/${post.year}/${post.slug}`;
      curiosityTracker.trackPostView(postId, path, post.title, post.tags || []);
    }, 0);

    // Save to local visited posts — kept synchronous so minimap updates
    // without delay; the write itself is tiny.
    const path = `/blog/${post.year}/${post.slug}`;
    try {
      const key = 'visited.posts';
      const raw = localStorage.getItem(key);
      const items: VisitedPostItem[] = raw ? JSON.parse(raw) : [];
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
      } catch {
        void 0;
      }
      console.warn('Failed to persist visited posts', err);
    }

    const loadSeriesPosts = async () => {
      if (!post.series) {
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

    const resolveSimulator = async () => {
      const baseContent = localized?.content ?? post.content;
      if (/<iframe[\s\S]*?>/i.test(baseContent)) {
        setAutoSimulatorSrc(null);
        return;
      }

      const candidate = buildSimulatorCandidate(post.year, post.slug);
      const exists = await checkSimulatorExists(candidate);
      if (!cancelled) {
        setAutoSimulatorSrc(exists ? candidate : null);
      }
    };

    void Promise.all([loadSeriesPosts(), resolveSimulator()]);

    return () => {
      clearTimeout(deferredAnalyticsId);
      cancelled = true;
    };
  }, [post, localized?.content]);

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
      setTranslationStatus('idle');
      return;
    }

    let cancelled = false;
    let pollTimer: number | null = null;
    let pollAttempts = 0;
    const pollStartMs = Date.now();
    const MAX_POLL_ATTEMPTS = 5;
    const MAX_POLL_DURATION_MS = 20_000;

    const scheduleRetry = (delaySeconds?: number) => {
      pollAttempts += 1;
      if (
        pollAttempts >= MAX_POLL_ATTEMPTS ||
        Date.now() - pollStartMs >= MAX_POLL_DURATION_MS
      ) {
        setTranslationStatus('idle');
        return;
      }
      const retryDelayMs = Math.max(1, delaySeconds ?? 15) * 1000;
      pollTimer = window.setTimeout(() => {
        void loadTranslation();
      }, retryDelayMs);
    };

    const loadTranslation = async () => {
      try {
        const result = await getCachedTranslation(year, slug, language);
        if (cancelled) return;

        if (result.translation) {
          setAiTranslation(result.translation);
        }

        if (result.pending) {
          setTranslationError(null);
          setTranslationStatus('warming');
          scheduleRetry(result.retryAfterSeconds);
          return;
        }

        setTranslationError(null);
        setTranslationStatus(result.translation ? 'ready' : 'idle');
      } catch (err) {
        console.error('Translation failed:', err);
        if (!cancelled) {
          if (err instanceof TranslationApiError) {
            setTranslationError({
              code: err.code,
              retryable: err.retryable,
            });
          } else {
            setTranslationError({
              code: 'UNKNOWN',
              retryable: false,
            });
          }
          setTranslationStatus('error');
        }
      }
    };

    setTranslationStatus('warming');
    setTranslationError(null);
    setAiTranslation(null);
    void loadTranslation();

    return () => {
      cancelled = true;
      if (pollTimer !== null) {
        clearTimeout(pollTimer);
      }
    };
  }, [language, post, slug, translationRetryNonce, year]);

  const handleRetryTranslation = useCallback(() => {
    setTranslationError(null);
    setAiTranslation(null);
    setTranslationStatus('idle');
    setTranslationRetryNonce(prev => prev + 1);
  }, []);

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
          const ragResults = await findRAGRelatedPosts(
            {
              title: post.title,
              content: post.content?.slice(0, 500) || '',
              slug: post.slug,
            },
            4
          );

          if (ragResults.length >= 2) {
            const ragPostPromises = ragResults.map(async r => {
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
          void 0;
        }

        if (selected.length < 3) {
          const byCategory = await getPostsPage({
            page: 1,
            pageSize: 6,
            category: post.category,
            sort: 'date',
          });
          const candidates = byCategory.items.filter(
            p =>
              `${p.year}/${p.slug}` !== `${post.year}/${post.slug}` &&
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
    // Related posts are below-the-fold — defer their fetch off the critical
    // paint path with a short timeout so the article renders first.
    const deferredRelatedId = setTimeout(() => {
      loadRelated();
    }, 200);
    return () => {
      clearTimeout(deferredRelatedId);
      cancelled = true;
    };
  }, [post]);

  const displayTitle = resolvedPost?.title ?? post?.title ?? '';

  const postView = useMemo<ResolvedPostViewModel | null>(() => {
    if (!post) return null;

    return (
      resolvedPost ?? {
        year: post.year,
        slug: post.slug,
        title: post.title,
        description: post.description,
        excerpt: post.excerpt,
        content: contentForRender,
        categoryLabel: post.category,
        tagLabels: [...post.tags],
        readingTimeLabel,
        author: post.author,
        date: post.date,
        tags: [...post.tags],
      }
    );
  }, [contentForRender, post, readingTimeLabel, resolvedPost]);

  const articleRenderProps = useMemo(
    () =>
      post
        ? {
            content: contentForRender,
            inlineEnabled,
            postTitle: displayTitle,
            postPath: `${post.year}/${post.slug}`,
            isTerminal,
          }
        : null,
    [contentForRender, displayTitle, inlineEnabled, isTerminal, post]
  );

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: postView?.title ?? post?.title,
          text: postView?.description ?? post?.description,
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
          isTerminal &&
            'bg-background from-background via-background to-background'
        )}
      >
        <div
          className='mx-auto w-full max-w-[1500px] px-4 pt-6 pb-32 sm:pt-12 2xl:max-w-[1600px]'
          style={safeAreaPaddingStyle}
        >
          <div
            className={cn(
              'relative grid grid-cols-1 justify-items-center gap-8'
            )}
          >
            <article
              className={cn(
                'mx-auto w-full max-w-5xl space-y-12',
                isTerminal && 'terminal-card p-4 sm:p-6'
              )}
            >
              <BlogPostHeader
                post={post}
                postView={postView!}
                year={year!}
                slug={slug!}
                language={language}
                setLanguage={setLanguage}
                availableLanguages={languageOptions}
                resolveLanguageName={resolveLanguageName}
                translationStatus={translationStatus}
                aiTranslation={aiTranslation}
                hasNativeTranslation={hasNativeTranslation}
                translationError={
                  translationError
                    ? {
                        message: getTranslationErrorMessage(
                          translationError.code
                        ),
                        retryable: translationError.retryable,
                      }
                    : null
                }
                onRetryTranslation={handleRetryTranslation}
                isTerminal={isTerminal}
                preservedFrom={preservedFrom}
                preservedSearch={preservedSearch}
                onShare={handleShare}
                backToBlogLabel={str.blog.backToBlog}
                shareLabel={str.blog.share}
                readingLanguageLabel={str.blog.readingLanguage}
                translatingLabel={str.blog.translating}
                aiTranslatedLabel={str.blog.aiTranslated}
                translationFailedLabel={str.blog.translationFailed}
                showingOriginalLabel={str.blog.showingOriginal}
                retryLabel={str.common.retry}
              />

              <MemoizedBlogPostContent {...articleRenderProps!} />

              {post.series && seriesPosts.length > 1 && (
                <MemoizedSeriesNavigation
                  currentPost={post}
                  seriesPosts={seriesPosts}
                />
              )}

              {/* AI Quiz Panel — shown only for posts with code blocks */}
              <MemoizedQuizPanel
                key={`${year}:${slug}`}
                content={contentForRender}
                postTitle={displayTitle}
                postTags={post.tags}
              />

              <MemoizedCommentSection postId={`${post.year}/${post.slug}`} />

              <MemoizedBlogPostRelated
                relatedPosts={resolvedRelatedPosts}
                preservedSearch={preservedSearch}
                preservedFrom={preservedFrom}
                isTerminal={isTerminal}
                relatedPostsLabel={str.blog.relatedPosts}
                relatedPostsDescLabel={str.blog.relatedPostsDesc}
              />
            </article>
          </div>
        </div>
      </div>
      <ArticleQuickActions
        postId={postId}
        isTerminal={isTerminal}
        tocContent={contentForRender}
        tocPostTitle={displayTitle}
      />
    </>
  );
};

export default BlogPost;
