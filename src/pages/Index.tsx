import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, BookOpen, Code2, Sparkles, TrendingUp } from 'lucide-react';
import { posts } from '@/data/posts';
import { formatDate } from '@/utils/blog';

const Index = () => {
  // Get latest 3 posts
  const latestPosts = posts.slice(0, 3);

  // Featured categories
  const categories = [
    { name: 'AI & ML', icon: Sparkles, count: 12, color: 'text-purple-500' },
    { name: 'Web Dev', icon: Code2, count: 18, color: 'text-blue-500' },
    { name: 'Algorithms', icon: TrendingUp, count: 15, color: 'text-green-500' },
    { name: 'DevOps', icon: BookOpen, count: 10, color: 'text-orange-500' },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <section className="mb-16 text-center space-y-6">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
          Welcome to{' '}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Nodove Blog
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Exploring the frontiers of software development, AI, and modern web technologies.
          Join me on this journey of continuous learning and innovation.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <Link to="/blog">
              <BookOpen className="mr-2 h-5 w-5" />
              Explore Blog
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/about">
              Learn More
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Categories Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-center">Popular Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((category) => (
            <Card key={category.name} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <category.icon className={`h-8 w-8 mx-auto mb-2 ${category.color}`} />
                <CardTitle className="text-lg">{category.name}</CardTitle>
                <CardDescription>{category.count} posts</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Latest Posts Section */}
      <section>
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Latest Posts</h2>
          <Button asChild variant="ghost">
            <Link to="/blog">
              View all posts
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {latestPosts.map((post) => (
            <Card key={post.slug} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary">{post.category}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(post.date)}
                  </span>
                </div>
                <CardTitle className="line-clamp-2">
                  <Link to={`/blog/${post.slug}`} className="hover:text-primary transition-colors">
                    {post.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="line-clamp-3">
                  {post.description}
                </CardDescription>
                <div className="mt-4 flex items-center text-sm text-muted-foreground">
                  <span>{post.readTime} min read</span>
                  {post.tags && post.tags.length > 0 && (
                    <>
                      <span className="mx-2">•</span>
                      <div className="flex gap-1">
                        {post.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Index;
