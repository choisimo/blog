import { useParams, Link, Navigate } from 'react-router-dom';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getPostBySlug, posts } from '@/data/posts';
import { formatDate } from '@/utils/blog';
import { 
  Calendar, 
  Clock, 
  ArrowLeft, 
  ArrowRight, 
  Home,
  Tag,
  Folder 
} from 'lucide-react';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  
  if (!slug) {
    return <Navigate to="/blog" replace />;
  }

  const post = getPostBySlug(slug);
  
  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  // 이전/다음 포스트 찾기
  const currentIndex = posts.findIndex(p => p.slug === slug);
  const prevPost = currentIndex > 0 ? posts[currentIndex - 1] : null;
  const nextPost = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* 네비게이션 */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/blog">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                블로그로 돌아가기
              </Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <Home className="w-4 h-4 mr-2" />
                홈
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <article className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 포스트 헤더 */}
        <header className="mb-8">
          <div className="mb-6">
            <h1 className="text-4xl font-bold mb-4 leading-tight">
              {post.title}
            </h1>
            <p className="text-xl text-muted-foreground">
              {post.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(post.date)}</span>
            </div>
            {post.readTime && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{post.readTime}분 읽기</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Folder className="w-3 h-3" />
              {post.category}
            </Badge>
            {post.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {tag}
              </Badge>
            ))}
          </div>
        </header>

        {/* 포스트 내용 */}
        <div className="mb-12">
          <MarkdownRenderer content={post.content} />
        </div>

        {/* 이전/다음 포스트 네비게이션 */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-4">
              {prevPost ? (
                <Link to={`/post/${prevPost.slug}`} className="group">
                  <div className="p-4 rounded-lg border hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <ArrowLeft className="w-4 h-4" />
                      이전 글
                    </div>
                    <h4 className="font-medium group-hover:text-primary transition-colors">
                      {prevPost.title}
                    </h4>
                  </div>
                </Link>
              ) : (
                <div />
              )}

              {nextPost ? (
                <Link to={`/post/${nextPost.slug}`} className="group">
                  <div className="p-4 rounded-lg border hover:bg-muted transition-colors text-right">
                    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground mb-2">
                      다음 글
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    <h4 className="font-medium group-hover:text-primary transition-colors">
                      {nextPost.title}
                    </h4>
                  </div>
                </Link>
              ) : (
                <div />
              )}
            </div>
          </CardContent>
        </Card>

        {/* 홈으로 돌아가기 */}
        <div className="text-center">
          <Link to="/blog">
            <Button variant="outline" size="lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              더 많은 글 보기
            </Button>
          </Link>
        </div>
      </article>
    </div>
  );
};

export default BlogPost;