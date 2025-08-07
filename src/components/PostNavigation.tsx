import { Link } from 'react-router-dom';
import { BlogPost } from '@/types/blog';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PostNavigationProps {
  currentPost: BlogPost;
  posts: BlogPost[];
}

export const PostNavigation = ({ currentPost, posts }: PostNavigationProps) => {
  const currentIndex = posts.findIndex(post => post.slug === currentPost.slug);
  const previousPost = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;
  const nextPost = currentIndex > 0 ? posts[currentIndex - 1] : null;

  if (!previousPost && !nextPost) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 mt-12">
      {previousPost && (
        <Card className="group hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <Link to={`/blog/${previousPost.slug}`} className="block">
              <div className="flex items-center text-sm text-muted-foreground mb-2">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous Post
              </div>
              <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">
                {previousPost.title}
              </h3>
            </Link>
          </CardContent>
        </Card>
      )}
      
      {nextPost && (
        <Card className="group hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <Link to={`/blog/${nextPost.slug}`} className="block">
              <div className="flex items-center justify-end text-sm text-muted-foreground mb-2">
                Next Post
                <ChevronRight className="h-4 w-4 ml-1" />
              </div>
              <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-2 text-right">
                {nextPost.title}
              </h3>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};