import {
  useParams,
  Link,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { ReadingProgress } from '@/components/common/ReadingProgress';
import { ScrollToTop } from '@/components/common/ScrollToTop';
import { getPostBySlug, getPosts } from '@/data/posts';
import { BlogPost as BlogPostType } from '@/types/blog';
import { formatDate } from '@/utils/blog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

const BlogPost = () => {
  const { year, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: unknown })?.from;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [posts, setPosts] = useState<BlogPostType[]>([]);

  const handleBackToBlog = () => {
    if (from && typeof from === 'object' && 'pathname' in from) {
      const fromLocation = from as { pathname: string; search?: string };
      const to = `${fromLocation.pathname}${fromLocation.search || ''}`;
      navigate(to);
    } else {
      navigate('/blog');
    }
  };

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

        // Load all posts first
        const loadedPosts = await getPosts();
        setPosts(loadedPosts);

        // Find the specific post
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

  // Get related posts
  const relatedPosts = posts
    .filter(
      p =>
        `${p.year}/${p.slug}` !== `${post.year}/${post.slug}` &&
        (p.category === post.category ||
          p.tags?.some((tag: string) => post.tags?.includes(tag)))
    )
    .slice(0, 3);

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
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSlug]}
                    components={{
                      code({ className, children, ..._props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;

                        return isInline ? (
                          <code
                            className={`${className} px-1 py-0.5 bg-muted rounded text-sm`}
                          >
                            {children}
                          </code>
                        ) : (
                          <SyntaxHighlighter
                            style={tomorrow}
                            language={match[1]}
                            PreTag='div'
                            className='rounded-md'
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        );
                      },
                      h1: ({ children }) => (
                        <h1 className='text-3xl font-bold mt-8 mb-4'>
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className='text-2xl font-semibold mt-6 mb-3'>
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className='text-xl font-medium mt-4 mb-2'>
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className='mb-4 leading-relaxed'>{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className='mb-4 space-y-1'>{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className='mb-4 space-y-1'>{children}</ol>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className='border-l-4 border-primary pl-4 italic my-4 text-muted-foreground'>
                          {children}
                        </blockquote>
                      ),
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          className='text-primary hover:underline'
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {post.content}
                  </ReactMarkdown>
                </div>
              </div>
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
