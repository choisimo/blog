import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Search } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="container mx-auto px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-primary/20">404</h1>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Page not found
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sorry, we couldn't find the page you're looking for. The page might have been moved or deleted.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Go to Homepage
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/blog">
              <Search className="mr-2 h-4 w-4" />
              Browse Blog Posts
            </Link>
          </Button>
        </div>

        <div className="mt-12">
          <h3 className="text-sm font-semibold text-muted-foreground">Popular posts</h3>
          <div className="mt-4 space-y-2">
            <Link
              to="/blog/2025/ai-models-for-coding"
              className="block text-sm text-primary hover:underline"
            >
              AI Models for Coding: A Comprehensive Guide
            </Link>
            <Link
              to="/blog/2025/docker-kubernetes-guide"
              className="block text-sm text-primary hover:underline"
            >
              Docker & Kubernetes: Modern Container Orchestration
            </Link>
            <Link
              to="/blog/2025/react-nextjs-modern-web-development"
              className="block text-sm text-primary hover:underline"
            >
              React & Next.js: Modern Web Development
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
