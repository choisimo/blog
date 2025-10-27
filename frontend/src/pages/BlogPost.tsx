import {
  useParams,
  Link,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import { ReadingProgress } from '@/components/common/ReadingProgress';
import { ScrollToTop } from '@/components/common/ScrollToTop';
import { getPostBySlug, getPostsPage, prefetchPost } from '@/data/posts';
import { BlogPost as BlogPostType } from '@/types/blog';
import { formatDate } from '@/utils/blog';
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
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
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
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPostType[]>([]);
  const [inlineEnabled, setInlineEnabled] = useState<boolean>(false);

  const handleBackToBlog = () => {
    if (from && typeof from === 'object' && 'pathname' in from) {
      const fromLocation = from as { pathname: string; search?: string };
      const to = `${fromLocation.pathname}${fromLocation.search || ''}`;
      navigate(to);
    } else {
      navigate('/blog');
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
      const deduped = [next, ...items.filter(i => i.path !== path)].slice(0, 12);
      localStorage.setItem(key, JSON.stringify(deduped));
      window.dispatchEvent(new CustomEvent('visitedposts:update'));
    } catch {
      // noop
    }
  }, [post]);

  // sync inline feature flag from localStorage and storage events
  useEffect(() => {
    const read = () => {
      try {
        const v = localStorage.getItem('aiMemo.inline.enabled');
        setInlineEnabled(!!JSON.parse(v || 'true'));
      } catch {
        setInlineEnabled(false);
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
      <div className='container mx-auto px-4 py-12 max-w-4xl'>
        <div className='space-y-4 animate-pulse'>
          <div className='h-4 bg-muted rounded w-24'></div>
          <div className='h-10 bg-muted rounded w-3/4'></div>
          <div className='h-4 bg-muted rounded w-1/2'></div>
          <div className='space-y-2 mt-8'>
            <div className='h-4 bg-muted rounded'></div>
            <div className='h-4 bg-muted rounded'></div>
            <div className='h-4 bg-muted rounded w-5/6'></div>
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
      <div className='min-h-screen bg-gradient-to-br from-background via-background to-muted/20'>
        <div className='container mx-auto px-4 py-8 max-w-6xl'>
          <article className='max-w-4xl mx-auto'>
            {/* Header Section */}
            <div className='mb-12'>
              <Button
                variant='ghost'
                onClick={handleBackToBlog}
                className='mb-8 hover:bg-primary/10'
              >
                <ArrowLeft className='mr-2 h-4 w-4' />
                Back to Blog
              </Button>

              {/* Enhanced Header Card */}
              <div className='bg-card/50 backdrop-blur-sm border rounded-2xl p-8 shadow-lg'>
                <div className='space-y-6'>
                  {/* Meta Information */}
                  <div className='flex flex-wrap items-center gap-3 text-sm'>
                    <Badge variant='secondary' className='px-3 py-1'>
                      {post.category}
                    </Badge>
                    <div className='flex items-center text-muted-foreground'>
                      <Calendar className='h-4 w-4 mr-1.5' />
                      {formatDate(post.date)}
                    </div>
                    {(post.readingTime || post.readTime) && (
                      <div className='flex items-center text-muted-foreground'>
                        <Clock className='h-4 w-4 mr-1.5' />
                        {post.readingTime || `${post.readTime} min read`}
                      </div>
                    )}
                    {post.author && (
                      <div className='flex items-center text-muted-foreground'>
                        <User className='h-4 w-4 mr-1.5' />
                        {post.author}
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <h1 className='text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent leading-tight'>
                    {post.title}
                  </h1>

                  {/* Description */}
                  <p className='text-lg md:text-xl text-muted-foreground leading-relaxed'>
                    {post.description}
                  </p>

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className='flex flex-wrap items-center gap-2'>
                      <Tag className='h-4 w-4 text-muted-foreground' />
                      {post.tags.map((tag: string) => (
                        <Badge
                          key={tag}
                          variant='outline'
                          className='hover:bg-primary/10'
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className='flex items-center gap-4 pt-2'>
                    <Button
                      onClick={handleShare}
                      variant='outline'
                      size='sm'
                      className='hover:bg-primary/10'
                    >
                      <Share2 className='mr-2 h-4 w-4' />
                      Share
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Separator className='my-12' />

            {/* Content Section */}
            <div className='mb-16'>
              <div className='bg-card/30 backdrop-blur-sm border rounded-2xl p-8 md:p-12 shadow-sm'>
                <div className='prose prose-gray dark:prose-invert max-w-none'>
                  <Suspense
                    fallback={
                      <div
                        className='space-y-3'
                        aria-label='Loading article content'
                      >
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
                      content={post.content}
                      inlineEnabled={inlineEnabled}
                      postTitle={post.title}
                    />
                  </Suspense>
                </div>
              </div>
            </div>

            <Separator className='my-12' />

            {/* Comments */}
            <div className='mt-16'>
              <CommentSection postId={`${post.year}/${post.slug}`} />
            </div>

            <Separator className='my-12' />

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <div className='mt-16'>
                <div className='bg-card/30 backdrop-blur-sm border rounded-2xl p-8 shadow-sm'>
                  <h2 className='text-2xl font-bold mb-8 flex items-center justify-center'>
                    <BookOpen className='mr-3 h-6 w-6' />
                    Related Posts
                  </h2>
                  <div className='grid gap-6 md:grid-cols-3'>
                    {relatedPosts.map(relatedPost => (
                      <Link
                        key={`${relatedPost.year}/${relatedPost.slug}`}
                        to={`/blog/${relatedPost.year}/${relatedPost.slug}`}
                        state={from ? { from } : undefined}
                        className='group'
                        onMouseEnter={() =>
                          prefetchPost(relatedPost.year, relatedPost.slug)
                        }
                        onFocus={() =>
                          prefetchPost(relatedPost.year, relatedPost.slug)
                        }
                      >
                        <div className='bg-card border rounded-xl p-6 hover:shadow-lg hover:scale-105 transition-all duration-300'>
                          <Badge variant='secondary' className='mb-3'>
                            {relatedPost.category}
                          </Badge>
                          <h3 className='font-semibold line-clamp-2 group-hover:text-primary transition-colors mb-2'>
                            {relatedPost.title}
                          </h3>
                          <p className='text-sm text-muted-foreground'>
                            {relatedPost.readingTime ||
                              `${relatedPost.readTime} min read`}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </article>
        </div>
      </div>
      <ScrollToTop />
    </>
  );
};

export default BlogPost;
