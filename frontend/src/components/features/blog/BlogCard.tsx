import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BlogPost } from '@/types/blog';
import { formatDate } from '@/utils/blog';
import { ArrowRight, Clock, User } from 'lucide-react';
import { DateDisplay, TagList } from '@/components/atoms';
import { prefetchPost } from '@/data/posts';

interface BlogCardProps {
  post: BlogPost;
}

const BlogCard = memo(({ post }: BlogCardProps) => {
  const location = useLocation();

  // Create the proper blog post URL using year and slug
  const postUrl = `/blog/${post.year}/${post.slug}`;

  // Display excerpt or description
  const displayText = post.excerpt || post.description;

  return (
    <Card className='h-full flex flex-col hover:shadow-lg transition-all duration-300 group border-border/50 hover:border-border'>
      {/* Cover image if available */}
      {post.coverImage && (
        <div className='aspect-video overflow-hidden'>
          <img
            src={post.coverImage}
            alt={post.title}
            className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
          />
        </div>
      )}

      <CardHeader className='pb-3'>
        <div className='flex justify-between items-start gap-2 mb-3'>
          <Badge variant='secondary' className='text-xs'>
            {post.category}
          </Badge>
          <DateDisplay date={formatDate(post.date)} />
        </div>
        <CardTitle className='line-clamp-2 group-hover:text-primary transition-colors leading-tight'>
          <Link
            to={postUrl}
            state={{ from: location }}
            className='hover:underline'
            onMouseEnter={() => prefetchPost(post.year, post.slug)}
            onFocus={() => prefetchPost(post.year, post.slug)}
          >
            {post.title}
          </Link>
        </CardTitle>
      </CardHeader>

      <CardContent className='flex-1 pt-0'>
        <CardDescription className='line-clamp-3 text-sm leading-relaxed'>
          {displayText}
        </CardDescription>
      </CardContent>

      <CardFooter className='flex flex-col gap-3 pt-3'>
        {/* Metadata row */}
        <div className='flex items-center justify-between w-full text-xs text-muted-foreground'>
          <div className='flex items-center gap-4'>
            {/* Reading time */}
            {(post.readingTime || post.readTime) && (
              <div className='flex items-center gap-1'>
                <Clock className='h-3 w-3' />
                <span>{post.readingTime || `${post.readTime} min read`}</span>
              </div>
            )}

            {/* Author */}
            {post.author && (
              <div className='flex items-center gap-1'>
                <User className='h-3 w-3' />
                <span>{post.author}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className='w-full'>
            <TagList tags={post.tags} maxVisible={3} size='sm' />
          </div>
        )}

        {/* Read more button */}
        <Button asChild variant='ghost' className='w-full group/button mt-2'>
          <Link
            to={postUrl}
            state={{ from: location }}
            onMouseEnter={() => prefetchPost(post.year, post.slug)}
            onFocus={() => prefetchPost(post.year, post.slug)}
          >
            Read more
            <ArrowRight className='ml-2 h-4 w-4 transition-transform group-hover/button:translate-x-1' />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
});

BlogCard.displayName = 'BlogCard';

export default BlogCard;
