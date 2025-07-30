import { BlogPost } from '@/types/blog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/blog';
import { Calendar, Clock, ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BlogCardProps {
  post: BlogPost;
}

export const BlogCard = ({ post }: BlogCardProps) => {
  return (
    <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-2 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
      
      <CardHeader className="space-y-5 relative z-10">
        {/* Meta information */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary/80 transition-colors">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">{formatDate(post.date)}</span>
          </div>
          {post.readTime && (
            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-accent/80 transition-colors">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{post.readTime}분</span>
            </div>
          )}
        </div>
        
        {/* Title and description */}
        <div className="space-y-3">
          <h3 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors duration-300 line-clamp-2">
            {post.title}
          </h3>
          <p className="text-muted-foreground leading-relaxed line-clamp-3 group-hover:text-foreground/80 transition-colors">
            {post.description}
          </p>
        </div>
        
        {/* Category and tags */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <Badge variant="default" className="text-xs font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
              {post.category}
            </Badge>
          </div>
          
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.slice(0, 3).map((tag) => (
                <Badge 
                  key={tag} 
                  variant="outline" 
                  className="text-xs font-medium border-muted-foreground/20 hover:border-primary hover:text-primary transition-colors cursor-default"
                >
                  #{tag}
                </Badge>
              ))}
              {post.tags.length > 3 && (
                <Badge 
                  variant="outline" 
                  className="text-xs font-medium border-muted-foreground/20 text-muted-foreground"
                >
                  +{post.tags.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 pb-6 relative z-10">
        <Link to={`/post/${post.slug}`} className="block">
          <Button 
            variant="ghost" 
            className="w-full group/btn relative overflow-hidden bg-gradient-to-r from-primary/5 to-accent/5 hover:from-primary hover:to-accent hover:text-primary-foreground border border-primary/20 hover:border-transparent transition-all duration-300"
          >
            <span className="relative z-10 font-semibold">계속 읽기</span>
            <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform duration-300 relative z-10" />
            
            {/* Button hover effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};