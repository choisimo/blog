import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BlogPost } from '@/types/blog';
import { formatDate } from '@/utils/blog';
import { Calendar, Clock, Tag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlogCardProps {
  post: BlogPost;
}

const BlogCard = React.memo(({ post }: BlogCardProps) => {
  const location = useLocation();
  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-all duration-300 group">
      <CardHeader>
        <div className="flex justify-between items-start mb-2">
          <Badge variant="secondary" className="mb-2">
            {post.category}
          </Badge>
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            {formatDate(post.date)}
          </div>
        </div>
        <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
          <Link to={`/blog/${post.slug}`} state={{ from: location }}>
            {post.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <CardDescription className="line-clamp-3">
          {post.description}
        </CardDescription>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {post.readTime} min read
          </div>
          {post.tags && post.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {post.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {post.tags.length > 2 && (
                <span className="text-xs">+{post.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
        <Button asChild variant="ghost" className="w-full group/button">
          <Link to={`/blog/${post.slug}`} state={{ from: location }}>
            Read more
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/button:translate-x-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
});

BlogCard.displayName = 'BlogCard';

export default BlogCard;