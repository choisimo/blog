import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowRight, BookOpen, Code2, Sparkles, TrendingUp } from 'lucide-react';
import { BlogCard, BlogCardSkeleton } from '@/components';
import { getPosts, getPostsPage, getPostBySlug } from '@/data/posts';
import type { BlogPost } from '@/types/blog';
import { SearchBar } from '@/components/features/search/SearchBar';
import { site } from '@/config/site';

// Shape used by visited posts in localStorage
// Matches VisitedPostsMinimap
interface VisitedPostItem {
  path: string; // "/blog/:year/:slug"
  title: string;
  coverImage?: string;
  year: string;
  slug: string;
}

const STORAGE_KEY = 'visited.posts';

const Index = () => {
  // Latest posts state
  const [latestPosts, setLatestPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All posts for search
  const [allPosts, setAllPosts] = useState<BlogPost[]>([]);
  const [searchResults, setSearchResults] = useState<BlogPost[] | null>(null);
  const [searchActive, setSearchActive] = useState(false);

  // Editor's Picks
  const [featuredPosts, setFeaturedPosts] = useState<BlogPost[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  // Recently Viewed (from localStorage)
  const [recentlyViewed, setRecentlyViewed] = useState<VisitedPostItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadLatest = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getPostsPage({ page: 1, pageSize: 3, sort: 'date' });
        if (!cancelled) setLatestPosts(res.items);
      } catch (e) {
        if (!cancelled) setError('Failed to load latest posts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadAllForSearch = async () => {
      try {
        const posts = await getPosts();
        if (!cancelled) setAllPosts(posts);
      } catch {
        // ignore search preload errors
      }
    };

    const loadFeatured = async () => {
      try {
        setFeaturedLoading(true);
        const picks = site.featured || [];
        if (picks.length > 0) {
          const resolved = await Promise.all(
            picks.map(async p => (await getPostBySlug(p.year, p.slug)) || null)
          );
          const filtered = resolved.filter((p): p is BlogPost => !!p).slice(0, 3);
          setFeaturedPosts(filtered);
        } else {
          const res = await getPostsPage({ page: 1, pageSize: 3, sort: 'date' });
          setFeaturedPosts(res.items);
        }
      } catch {
        setFeaturedPosts([]);
      } finally {
        setFeaturedLoading(false);
      }
    };

    loadLatest();
    loadAllForSearch();
    loadFeatured();

    return () => {
      cancelled = true;
    };
  }, []);

  // Read recently viewed from localStorage and keep in sync
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const arr: VisitedPostItem[] = raw ? JSON.parse(raw) : [];
        setRecentlyViewed(Array.isArray(arr) ? arr.slice(0, 6) : []);
      } catch {
        setRecentlyViewed([]);
      }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === STORAGE_KEY) read();
    };
    const onCustom = () => read();
    window.addEventListener('storage', onStorage);
    window.addEventListener('visitedposts:update', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('visitedposts:update', onCustom as EventListener);
    };
  }, []);

  // Featured categories (static placeholders)
  const categories = useMemo(
    () => [
      { name: 'AI & ML', icon: Sparkles, count: 12, color: 'text-purple-500' },
      { name: 'Web Dev', icon: Code2, count: 18, color: 'text-blue-500' },
      { name: 'Algorithms', icon: TrendingUp, count: 15, color: 'text-green-500' },
      { name: 'DevOps', icon: BookOpen, count: 10, color: 'text-orange-500' },
    ],
    []
  );

  return (
    <div className='container mx-auto px-4 py-12'>
      {/* Hero Section */}
      <section className='mb-10 text-center space-y-6'>
        <h1 className='text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight'>
          Welcome to{' '}
          <span className='bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent'>
            Nodove Blog
          </span>
        </h1>
        <p className='text-xl text-muted-foreground max-w-2xl mx-auto'>
          최신 웹, AI, 개발 인사이트를 빠르게 공유합니다.
        </p>
        <div className='max-w-2xl mx-auto'>
          <SearchBar
            posts={allPosts}
            onSearchResults={results => {
              setSearchResults(results);
              setSearchActive(results !== allPosts);
            }}
            placeholder='Search posts, tags, categories...'
          />
        </div>
        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <Button asChild size='lg'>
            <Link to='/blog'>
              <BookOpen className='mr-2 h-5 w-5' />
              Enter Blog
            </Link>
          </Button>
          <Button asChild variant='outline' size='lg'>
            <Link to='/about'>
              Learn More
              <ArrowRight className='ml-2 h-5 w-5' />
            </Link>
          </Button>
        </div>
      </section>

      {/* Search Results Section */}
      {searchActive && searchResults && (
        <section className='mb-16'>
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-3xl font-bold'>Search Results</h2>
            <div className='text-sm text-muted-foreground'>
              {searchResults.length} match{searchResults.length === 1 ? '' : 'es'}
            </div>
          </div>
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {searchResults.slice(0, 9).map(post => (
              <BlogCard key={`${post.year}/${post.slug}`} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Editor's Picks Section */}
      <section className='mb-16'>
        <div className='flex items-center justify-between mb-8'>
          <h2 className='text-3xl font-bold'>Editor&apos;s Picks</h2>
        </div>
        <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {featuredLoading
            ? Array.from({ length: 3 }).map((_, i) => <BlogCardSkeleton key={i} />)
            : featuredPosts.map(post => (
                <BlogCard key={`${post.year}/${post.slug}`} post={post} />
              ))}
        </div>
      </section>

      {/* Recently Viewed Section */}
      {recentlyViewed.length > 0 && (
        <section className='mb-16'>
          <div className='flex items-center justify-between mb-8'>
            <h2 className='text-3xl font-bold'>Recently Viewed</h2>
            <Button asChild variant='ghost'>
              <Link to='/blog'>
                Continue exploring
                <ArrowRight className='ml-2 h-4 w-4' />
              </Link>
            </Button>
          </div>
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {recentlyViewed.map(item => (
              <Link key={item.path} to={item.path} className='group'>
                <div className='bg-card border rounded-xl p-6 hover:shadow-lg hover:scale-105 transition-all duration-300'>
                  <div className='mb-3 text-sm text-muted-foreground'>{item.year}/{item.slug}</div>
                  <h3 className='font-semibold line-clamp-2 group-hover:text-primary transition-colors mb-2'>{item.title}</h3>
                  {item.coverImage ? (
                    <div className='mt-2 h-36 w-full overflow-hidden rounded'>
                      <img src={item.coverImage} alt='' className='h-full w-full object-cover' />
                    </div>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Categories Section */}
      <section className='mb-16'>
        <h2 className='text-3xl font-bold mb-8 text-center'>Popular Categories</h2>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          {categories.map(category => (
            <Card
              key={category.name}
              className='group hover:shadow-xl transition-all cursor-pointer hover:-translate-y-0.5'
            >
              <CardHeader className='text-center'>
                <category.icon className={`h-8 w-8 mx-auto mb-2 ${category.color} group-hover:text-primary`} />
                <CardTitle className='text-lg'>{category.name}</CardTitle>
                <CardDescription>{category.count} posts</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Latest Posts Section */}
      <section>
        <div className='flex justify-between items-center mb-8'>
          <h2 className='text-3xl font-bold'>Latest Posts</h2>
          <Button asChild variant='ghost'>
            <Link to='/blog'>
              View all posts
              <ArrowRight className='ml-2 h-4 w-4' />
            </Link>
          </Button>
        </div>

        {error ? (
          <div className='text-center py-8'>
            <p className='text-red-500 mb-4'>{error}</p>
            <Button variant='outline' onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <BlogCardSkeleton key={i} />)
              : latestPosts.map(post => <BlogCard key={`${post.year}/${post.slug}`} post={post} />)}
          </div>
        )}
      </section>
    </div>
  );
};

export default Index;
