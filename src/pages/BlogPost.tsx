import { useParams, Link, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { posts } from '@/data/posts';
import { formatDate } from '@/utils/blog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Calendar, Clock, Tag, Share2, BookOpen } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const BlogPost = () => {
  const { year, slug } = useParams();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const post = posts.find(p => p.slug === slug && p.year === year);

  useEffect(() => {
    if (!post) {
      setLoading(false);
      setError(true);
      return;
    }

    fetch(`/posts/${year}/${slug}.md`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch');
        }
        return response.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [year, slug, post]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.description,
          url: url,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: "The post URL has been copied to your clipboard.",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="space-y-4 animate-pulse">
          <div className="h-4 bg-muted rounded w-24"></div>
          <div className="h-10 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="space-y-2 mt-8">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return <Navigate to="/404" replace />;
  }

  // Get related posts
  const relatedPosts = posts
    .filter(p => p.slug !== post.slug && 
      (p.category === post.category || 
       p.tags?.some(tag => post.tags?.includes(tag))))
    .slice(0, 3);

  return (
    <article className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <Button asChild variant="ghost" className="mb-6">
          <Link to="/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Link>
        </Button>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{post.category}</Badge>
            <div className="flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              {formatDate(post.date)}
            </div>
            <div className="flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {post.readTime} min read
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            {post.title}
          </h1>

          <p className="text-xl text-muted-foreground">
            {post.description}
          </p>

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              {post.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 pt-4">
            <Button onClick={handleShare} variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      <div className="mb-12">
        <MarkdownRenderer content={content} />
      </div>

      <Separator className="my-8" />

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <BookOpen className="mr-2 h-6 w-6" />
            Related Posts
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedPosts.map((relatedPost) => (
              <Link
                key={relatedPost.slug}
                to={`/blog/${relatedPost.year}/${relatedPost.slug}`}
                className="group"
              >
                <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <Badge variant="secondary" className="mb-2">
                    {relatedPost.category}
                  </Badge>
                  <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                    {relatedPost.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {relatedPost.readTime} min read
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

export default BlogPost;