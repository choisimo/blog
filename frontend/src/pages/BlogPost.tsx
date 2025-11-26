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
import { getPostBySlug, getPostsPage, prefetchPost } from '@/data/posts';
import { BlogPost as BlogPostType } from '@/types/blog';
import {
  formatDate,
  getAvailableLanguages,
  resolveLocalizedPost,
} from '@/utils/blog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { CommentSection } from '@/components/features/blog';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Tag,
  Share2,
  BookOpen,
  User,
  Languages,
  MessageCircle,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import useLanguage from '@/hooks/useLanguage';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
// import SparkInline from '@/components/features/sentio/SparkInline';

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPostType[]>([]);
  const [inlineEnabled, setInlineEnabled] = useState<boolean>(true);

  const localized = useMemo(
    () => (post ? resolveLocalizedPost(post, language) : null),
    [post, language]
  );

  const availableLanguages = useMemo(
    () => (post ? getAvailableLanguages(post) : []),
    [post]
  );

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

  const backLabel = language === 'ko' ? '블로그로 돌아가기' : 'Back to Blog';
  const shareLabel = language === 'ko' ? '공유하기' : 'Share';
  const relatedLabel = language === 'ko' ? '관련 글' : 'Related Posts';
  const commentsLabel = language === 'ko' ? '댓글' : 'Comments';

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

  // After post loads, record it to visited posts
  useEffect(() => {
    if (!post) return;
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
      } catch {}
      console.warn('Failed to persist visited posts', err);
    }
  }, [post]);

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
        const byCategory = await getPostsPage({
          page: 1,
          pageSize: 6,
          category: post.category,
          sort: 'date',
        });
        const candidates = byCategory.items.filter(
          p => `${p.year}/${p.slug}` !== `${post.year}/${post.slug}`
        );
        let selected = candidates.slice(0, 3);
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
          className='mx-auto w-full max-w-6xl px-4 pt-6 pb-32 sm:pt-12'
          style={safeAreaPaddingStyle}
        >
          <article
            className={cn(
              'mx-auto max-w-3xl space-y-12',
              isTerminal && 'terminal-card p-4 sm:p-6'
            )}
          >
            <header className='space-y-6'>
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
                  {isTerminal ? `< ${backLabel}` : backLabel}
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
                  {shareLabel}
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
                        'text-base leading-relaxed text-muted-foreground dark:text-white/70 sm:text-lg',
                        isTerminal && 'border-l-2 border-primary/30 pl-4'
                      )}
                    >
                      {localized?.description ?? post.description}
                    </p>
                  )}

                  {post.coverImage && (
                    <div
                      className={cn(
                        'overflow-hidden rounded-3xl border border-white/40 bg-muted shadow-sm dark:border-white/10 dark:bg-white/5',
                        isTerminal && 'rounded-lg border-border'
                      )}
                    >
                      <img
                        src={post.coverImage}
                        alt={localized?.title ?? post.title}
                        className='h-64 w-full object-cover sm:h-80'
                      />
                    </div>
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

                  {availableLanguages.length > 1 && (
                    <div
                      className={cn(
                        'flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-xs font-medium text-muted-foreground dark:border-primary/40 dark:bg-primary/10 dark:text-white/80',
                        isTerminal && 'rounded-lg font-mono border-solid'
                      )}
                    >
                      <Languages className='h-4 w-4 text-primary' />
                      <span className='uppercase tracking-wide'>
                        {language === 'ko' ? '읽기 언어' : 'Reading language'}
                      </span>
                      <div className='flex flex-wrap gap-2'>
                        {availableLanguages.map(code => (
                          <button
                            key={code}
                            type='button'
                            onClick={() => setLanguage(code)}
                            className={cn(
                              'rounded-full px-3 py-1 text-sm transition-colors',
                              language === code
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-white/70 text-foreground/70 dark:bg-background/60',
                              isTerminal && 'rounded font-mono'
                            )}
                          >
                            {resolveLanguageName(code)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {post.tags && post.tags.length > 0 && (
                    <div
                      className={cn(
                        'flex flex-wrap items-center gap-2 text-muted-foreground dark:text-white/70',
                        isTerminal && 'font-mono text-xs'
                      )}
                    >
                      <Tag className='h-4 w-4 text-muted-foreground dark:text-white/70' />
                      {isTerminal && <span className='text-primary'>tags:</span>}
                      {post.tags.map(tag => (
                        <Badge
                          key={tag}
                          variant='outline'
                          className={cn(
                            'rounded-full px-3 py-1 text-xs dark:border-white/20 dark:text-white',
                            isTerminal && 'rounded border-primary/40 text-primary'
                          )}
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
                  />
                </Suspense>
              </div>
            </section>

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
                      {isTerminal ? `> ${relatedLabel}` : relatedLabel}
                    </h2>
                    <p
                      className={cn(
                        'text-sm text-muted-foreground dark:text-white/70',
                        isTerminal && 'font-mono text-xs'
                      )}
                    >
                      {language === 'ko'
                        ? '비슷한 맥락의 글을 더 읽어보세요.'
                        : 'Continue reading with similar perspectives.'}
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
                      <p className='mt-2 line-clamp-2 text-sm text-muted-foreground dark:text-white/70'>
                        {relatedPost.excerpt || relatedPost.description}
                      </p>
                      {(relatedPost.readingTime || relatedPost.readTime) && (
                        <p
                          className={cn(
                            'mt-3 text-xs uppercase tracking-wide text-muted-foreground dark:text-white/60',
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
        </div>
      </div>
      <ScrollToTop />
    </>
  );
};

export default BlogPost;
