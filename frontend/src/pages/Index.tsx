import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { BlogCardSkeleton, PostCard } from '@/components';
import { getPosts, getPostsPage, getPostBySlug } from '@/data/posts';
import type { BlogPost } from '@/types/blog';
import { SearchBar } from '@/components/features/search/SearchBar';
import { site } from '@/config/site';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { formatDate } from '@/utils/blog';
import { getEditorPicks, getRealtimeVisitors, startHeartbeat, stopHeartbeat, type EditorPick } from '@/services/analytics';
import { getCategoryCounts } from '@/utils/categoryNormalize';
import TerminalCategories from '@/components/features/navigation/TerminalCategories';
import { AIConsole } from '@/components/features/console';

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
  const { isTerminal } = useTheme();
  
  // Latest posts state
  const [latestPosts, setLatestPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Realtime visitor count
  const [activeVisitors, setActiveVisitors] = useState<number>(0);

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
      } catch {
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

        // 1. Try to load from D1 database (analytics-based editor picks)
        const dbPicks = await getEditorPicks(3);
        
        if (dbPicks.length > 0) {
          // Resolve posts from D1 picks
          const resolved = await Promise.all(
            dbPicks.map(async (pick: EditorPick) => {
              const post = await getPostBySlug(pick.year, pick.post_slug);
              return post || null;
            })
          );
          const filtered = resolved.filter((p): p is BlogPost => !!p);
          
          if (filtered.length > 0) {
            setFeaturedPosts(filtered);
            return;
          }
        }

        // 2. Fallback: Use static site.featured config
        const picks = site.featured || [];
        if (picks.length > 0) {
          const resolved = await Promise.all(
            picks.map(async p => (await getPostBySlug(p.year, p.slug)) || null)
          );
          const filtered = resolved
            .filter((p): p is BlogPost => !!p)
            .slice(0, 3);
          if (filtered.length > 0) {
            setFeaturedPosts(filtered);
            return;
          }
        }

        // 3. Final fallback: Latest posts
        const res = await getPostsPage({
          page: 1,
          pageSize: 3,
          sort: 'date',
        });
        setFeaturedPosts(res.items);
      } catch {
        // Fallback to latest posts on error
        try {
          const res = await getPostsPage({
            page: 1,
            pageSize: 3,
            sort: 'date',
          });
          setFeaturedPosts(res.items);
        } catch {
          setFeaturedPosts([]);
        }
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
      window.removeEventListener(
        'visitedposts:update',
        onCustom as EventListener
      );
    };
  }, []);

  // Realtime visitor tracking
  useEffect(() => {
    startHeartbeat();
    
    // Fetch initial count
    getRealtimeVisitors().then(setActiveVisitors);
    
    // Refresh count every 30 seconds
    const interval = setInterval(() => {
      getRealtimeVisitors().then(setActiveVisitors);
    }, 30000);
    
    return () => {
      stopHeartbeat();
      clearInterval(interval);
    };
  }, []);

  // Featured categories with dynamic counts from allPosts (normalized)
  const categories = useMemo(() => {
    const categoryMap = getCategoryCounts(allPosts);

    const baseCategories = [
      { name: 'AI & ML', icon: Sparkles, color: 'text-purple-500' },
      { name: 'Web Dev', icon: Code2, color: 'text-blue-500' },
      { name: 'Algorithms', icon: TrendingUp, color: 'text-green-500' },
      { name: 'DevOps', icon: BookOpen, color: 'text-orange-500' },
    ];

    return baseCategories.map(cat => ({
      ...cat,
      count: categoryMap[cat.name] || 0,
    }));
  }, [allPosts]);

  // Carousel scroll handlers
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className='container mx-auto px-4 pt-8 pb-28'>
      {/* ============================================
          Hero Section - Split Layout with Featured Post
          ============================================ */}
      <section className='mb-16'>
        <div className='grid gap-6 md:grid-cols-12 md:gap-8 items-center'>
          {/* Left: Typography & CTA */}
          <div className='md:col-span-5 space-y-6 text-left'>
            <div className='space-y-2'>
              <p className={cn(
                'text-sm font-medium tracking-widest uppercase',
                isTerminal ? 'text-primary font-mono' : 'text-muted-foreground'
              )}>
                {isTerminal ? '> WELCOME_TO' : 'Welcome to'}
              </p>
              <h1 className={cn(
                'text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]',
                isTerminal && 'font-mono'
              )}>
                <span className={cn(
                  isTerminal 
                    ? 'text-foreground' 
                    : 'bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent'
                )}>
                  Architecting
                </span>
                <br />
                <span className={cn(
                  isTerminal 
                    ? 'text-primary terminal-glow' 
                    : 'bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent'
                )}>
                  Intelligence
                </span>
              </h1>
            </div>
            <p className={cn(
              'text-lg leading-relaxed max-w-md',
              isTerminal ? 'text-muted-foreground' : 'text-muted-foreground'
            )}>
              AI, 시스템 설계, 그리고 코드의 본질을 탐구하는 기술 블로그
            </p>
            
            {/* Search Bar */}
            <div className='max-w-md'>
              <SearchBar
                posts={allPosts}
                onSearchResults={results => {
                  setSearchResults(results);
                  setSearchActive(results !== allPosts);
                }}
                placeholder='Search posts, tags, categories...'
              />
            </div>
            
            {/* CTA Buttons */}
            <div className='flex flex-wrap gap-3 pt-2'>
              <Button 
                asChild 
                size='lg' 
                variant={isTerminal ? 'terminal-active' : 'default'}
                className={cn(
                  isTerminal && 'shadow-[0_0_16px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)]'
                )}
              >
                <Link to='/blog'>
                  <BookOpen className='mr-2 h-5 w-5' />
                  Explore Posts
                </Link>
              </Button>
              <Button 
                asChild 
                variant='outline' 
                size='lg'
                className={cn(
                  isTerminal && 'font-mono border-border text-foreground hover:border-primary hover:text-primary'
                )}
              >
                <Link to='/about'>
                  About Me
                  <ArrowRight className='ml-2 h-5 w-5' />
                </Link>
              </Button>
            </div>
          </div>

          {/* Right: AI Console (RAG-powered) */}
          <div className='md:col-span-7'>
            <AIConsole className="aspect-[16/10] h-auto" />
          </div>
        </div>
      </section>

      {/* ============================================
          Search Results Section
          ============================================ */}
      {searchActive && searchResults && (
        <section className='mb-16'>
          <div className='flex items-center justify-between mb-6'>
            <h2 className={cn(
              'text-2xl font-bold',
              isTerminal && 'font-mono'
            )}>
              {isTerminal ? '> search_results' : 'Search Results'}
            </h2>
            <div className='text-sm text-muted-foreground'>
              {searchResults.length} match
              {searchResults.length === 1 ? '' : 'es'}
            </div>
          </div>
          <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {searchResults.slice(0, 9).map(post => (
              <PostCard key={`${post.year}/${post.slug}`} post={post} variant="grid" />
            ))}
          </div>
        </section>
      )}

      {/* ============================================
          Editor's Picks - Bento Grid (1 Main + 2 Side)
          ============================================ */}
      <section className='mb-16'>
        <div className='flex items-center justify-between mb-8'>
          <h2 className={cn(
            'text-2xl font-bold',
            isTerminal && 'font-mono'
          )}>
            {isTerminal ? '// editor_picks' : "Editor's Picks"}
          </h2>
        </div>
        
        {featuredLoading ? (
          <div className='grid lg:grid-cols-3 gap-6'>
            {Array.from({ length: 3 }).map((_, i) => (
              <BlogCardSkeleton key={i} />
            ))}
          </div>
        ) : featuredPosts.length > 0 ? (
          <div className='grid lg:grid-cols-3 gap-6'>
            {/* Main Featured Card (2/3 width on desktop) */}
            <div className='lg:col-span-2'>
              <Link 
                to={`/blog/${featuredPosts[0].year}/${featuredPosts[0].slug}`}
                className='group block h-full'
              >
                <div className={cn(
                  'relative h-full min-h-[400px] rounded-2xl overflow-hidden',
                  isTerminal 
                    ? 'border border-border bg-card/50 backdrop-blur-sm hover:border-primary/50' 
                    : 'bg-card shadow-md hover:shadow-xl',
                  'transition-all duration-300'
                )}>
                  {featuredPosts[0].coverImage ? (
                    <OptimizedImage
                      src={featuredPosts[0].coverImage}
                      alt={featuredPosts[0].title}
                      className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
                    />
                  ) : (
                    <div className={cn(
                      'w-full h-full',
                      isTerminal 
                        ? 'bg-gradient-to-br from-primary/5 to-card' 
                        : 'bg-gradient-to-br from-muted/80 to-muted'
                    )} />
                  )}
                  
                  <div className={cn(
                    'absolute inset-0',
                    isTerminal 
                      ? 'bg-gradient-to-t from-background via-background/70 to-transparent' 
                      : 'bg-gradient-to-t from-black/80 via-black/40 to-transparent'
                  )} />
                  
                  <div className='absolute bottom-0 left-0 right-0 p-8'>
                    <div className='flex items-center gap-3 mb-4'>
                      <span className={cn(
                        'px-3 py-1 text-xs font-medium rounded-full',
                        isTerminal 
                          ? 'bg-primary/20 text-primary border border-primary/30' 
                          : 'bg-primary text-primary-foreground'
                      )}>
                        {featuredPosts[0].category}
                      </span>
                      {featuredPosts[0].readingTime && (
                        <span className={cn(
                          'flex items-center gap-1 text-sm',
                          isTerminal ? 'text-muted-foreground' : 'text-white/70'
                        )}>
                          <Clock className='h-3.5 w-3.5' />
                          {featuredPosts[0].readingTime}
                        </span>
                      )}
                    </div>
                    <h3 className={cn(
                      'text-2xl md:text-3xl font-bold mb-3 line-clamp-2',
                      isTerminal 
                        ? 'text-foreground group-hover:text-primary' 
                        : 'text-white',
                      'transition-colors'
                    )}>
                      {featuredPosts[0].title}
                    </h3>
                    {featuredPosts[0].description && (
                      <p className={cn(
                        'line-clamp-2 max-w-xl',
                        isTerminal ? 'text-muted-foreground' : 'text-white/80'
                      )}>
                        {featuredPosts[0].description}
                      </p>
                    )}
                  </div>

                  {isTerminal && (
                    <div className='absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border-2 border-primary/30 rounded-2xl' />
                  )}
                </div>
              </Link>
            </div>

            {/* Side Cards (1/3 width, stacked) */}
            <div className='flex flex-col gap-6'>
              {featuredPosts.slice(1, 3).map(post => (
                <Link 
                  key={`${post.year}/${post.slug}`}
                  to={`/blog/${post.year}/${post.slug}`}
                  className='group flex-1'
                >
                  <div className={cn(
                    'h-full rounded-xl overflow-hidden flex flex-col',
                    isTerminal 
                      ? 'border border-border bg-card/30 backdrop-blur-sm hover:border-primary/50 hover:bg-card/50' 
                      : 'bg-card border border-border/50 shadow-sm hover:shadow-lg',
                    'transition-all duration-300'
                  )}>
                    {post.coverImage && (
                      <div className='aspect-[16/9] overflow-hidden'>
                        <OptimizedImage
                          src={post.coverImage}
                          alt={post.title}
                          className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                        />
                      </div>
                    )}
                    <div className='p-5 flex-1 flex flex-col'>
                      <div className='flex items-center gap-2 mb-2'>
                        <span className={cn(
                          'px-2 py-0.5 text-xs rounded',
                          isTerminal 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-secondary text-secondary-foreground'
                        )}>
                          {post.category}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          {formatDate(post.date)}
                        </span>
                      </div>
                      <h3 className={cn(
                        'font-semibold line-clamp-2 flex-1',
                        isTerminal 
                          ? 'text-foreground group-hover:text-primary' 
                          : 'group-hover:text-primary',
                        'transition-colors'
                      )}>
                        {post.title}
                      </h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* ============================================
          Recently Viewed - Horizontal Carousel
          ============================================ */}
      {recentlyViewed.length > 0 && (
        <section className='mb-16'>
          <div className='flex items-center justify-between mb-6'>
            <h2 className={cn(
              'text-2xl font-bold',
              isTerminal && 'font-mono'
            )}>
              {isTerminal ? '// recently_viewed' : 'Recently Viewed'}
            </h2>
            <div className='flex items-center gap-2'>
              <Button 
                variant='ghost' 
                size='icon'
                className={cn(
                  'h-8 w-8 rounded-full',
                  isTerminal && 'hover:bg-primary/10 hover:text-primary'
                )}
                onClick={() => scrollCarousel('left')}
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <Button 
                variant='ghost' 
                size='icon'
                className={cn(
                  'h-8 w-8 rounded-full',
                  isTerminal && 'hover:bg-primary/10 hover:text-primary'
                )}
                onClick={() => scrollCarousel('right')}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
              <Button asChild variant='ghost' size='sm'>
                <Link to='/blog' className={cn(
                  isTerminal && 'hover:text-primary'
                )}>
                  View all
                  <ArrowRight className='ml-1 h-3 w-3' />
                </Link>
              </Button>
            </div>
          </div>
          
          {/* Carousel Container */}
          <div 
            ref={carouselRef}
            className='flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40'
          >
            {recentlyViewed.map(item => (
              <Link 
                key={item.path} 
                to={item.path} 
                className='group flex-shrink-0 w-[280px] snap-start'
              >
                <div className={cn(
                  'rounded-xl overflow-hidden h-full',
                  isTerminal 
                    ? 'border border-border bg-card/30 backdrop-blur-sm hover:border-primary/50 hover:bg-card/50' 
                    : 'bg-card border border-border/50 shadow-sm hover:shadow-md',
                  'transition-all duration-300'
                )}>
                  {item.coverImage ? (
                    <div className='aspect-[16/9] overflow-hidden'>
                      <OptimizedImage
                        src={item.coverImage}
                        alt=''
                        className='h-full w-full object-cover group-hover:scale-105 transition-transform duration-300'
                      />
                    </div>
                  ) : (
                    <div className={cn(
                      'aspect-[16/9]',
                      isTerminal 
                        ? 'bg-gradient-to-br from-primary/5 to-card' 
                        : 'bg-gradient-to-br from-muted to-muted/50'
                    )} />
                  )}
                  <div className='p-4'>
                    <div className='text-xs text-muted-foreground mb-1'>
                      {item.year}/{item.slug}
                    </div>
                    <h3 className={cn(
                      'font-medium line-clamp-2 text-sm',
                      isTerminal 
                        ? 'text-foreground group-hover:text-primary' 
                        : 'group-hover:text-primary',
                      'transition-colors'
                    )}>
                      {item.title}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ============================================
          Categories Section - Compact Grid / Terminal Tree
          ============================================ */}
      <section className='mb-16'>
        <h2 className={cn(
          'text-2xl font-bold mb-6 text-center',
          isTerminal && 'font-mono'
        )}>
          {isTerminal ? '// categories' : 'Popular Categories'}
        </h2>

        <div className='grid gap-6 md:grid-cols-12 md:gap-8 items-start'>
          <div className='md:col-span-7'>
            {isTerminal ? (
              <div className='w-full'>
                <TerminalCategories categories={categories} />
              </div>
            ) : (
              <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
                {categories.map(category => (
                  <Link
                    key={category.name}
                    to={`/blog?category=${encodeURIComponent(category.name)}`}
                  >
                    <Card
                      className={cn(
                        'group cursor-pointer transition-all duration-300',
                        'hover:shadow-lg hover:-translate-y-0.5'
                      )}
                    >
                      <CardHeader className='text-center py-4 px-3'>
                        <category.icon
                          className={cn(
                            'h-6 w-6 mx-auto mb-2 transition-colors',
                            category.color,
                            'group-hover:scale-110 transition-transform'
                          )}
                        />
                        <CardTitle className='text-sm font-medium'>
                          {category.name}
                        </CardTitle>
                        <CardDescription className='text-xs'>
                          {category.count} posts
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className='md:col-span-5'>
            <CategorySuggestionsPanel isTerminal={isTerminal} activeVisitors={activeVisitors} />
          </div>
        </div>
      </section>

      {/* ============================================
          Latest Posts - List View (Magazine Style)
          ============================================ */}
      <section>
        <div className='flex justify-between items-center mb-6'>
          <h2 className={cn(
            'text-2xl font-bold',
            isTerminal && 'font-mono'
          )}>
            {isTerminal ? '// latest_posts' : 'Latest Posts'}
          </h2>
          <Button asChild variant='ghost' size='sm'>
            <Link to='/blog' className={cn(
              isTerminal && 'hover:text-primary'
            )}>
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
        ) : loading ? (
          <div className='space-y-4'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  'h-32 rounded-xl animate-pulse',
                  isTerminal ? 'bg-card border border-border' : 'bg-muted'
                )}
              />
            ))}
          </div>
        ) : (
          <div className='space-y-4'>
            {latestPosts.map(post => (
              <Link
                key={`${post.year}/${post.slug}`}
                to={`/blog/${post.year}/${post.slug}`}
                className='group block'
              >
                <article className={cn(
                  'flex gap-5 rounded-xl p-4 transition-all duration-300',
                  isTerminal 
                    ? 'border border-border bg-card/30 backdrop-blur-sm hover:border-primary/50 hover:bg-card/50' 
                    : 'bg-card border border-border/50 shadow-sm hover:shadow-md'
                )}>
                  {/* Thumbnail */}
                  <div className='flex-shrink-0 w-32 md:w-48 aspect-[16/10] rounded-lg overflow-hidden'>
                    {post.coverImage ? (
                      <OptimizedImage
                        src={post.coverImage}
                        alt={post.title}
                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                      />
                    ) : (
                      <div className={cn(
                        'w-full h-full flex items-center justify-center',
                        isTerminal 
                          ? 'bg-gradient-to-br from-primary/5 to-card' 
                          : 'bg-gradient-to-br from-muted to-muted/50'
                      )}>
                        <BookOpen className='h-8 w-8 text-muted-foreground/50' />
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className='flex-1 min-w-0 flex flex-col justify-center'>
                    <div className='flex flex-wrap items-center gap-2 mb-2'>
                      <span className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded',
                        isTerminal 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-secondary text-secondary-foreground'
                      )}>
                        {post.category}
                      </span>
                      <span className='text-xs text-muted-foreground'>
                        {formatDate(post.date)}
                      </span>
                      {post.readingTime && (
                        <span className='text-xs text-muted-foreground flex items-center gap-1'>
                          <Clock className='h-3 w-3' />
                          {post.readingTime}
                        </span>
                      )}
                    </div>
                    <h3 className={cn(
                      'font-semibold text-lg mb-1 line-clamp-1',
                      isTerminal 
                        ? 'text-foreground group-hover:text-primary' 
                        : 'group-hover:text-primary',
                      'transition-colors'
                    )}>
                      {post.title}
                    </h3>
                    {post.description && (
                      <p className='text-sm text-muted-foreground line-clamp-1 sm:line-clamp-2'>
                        {post.description}
                      </p>
                    )}
                  </div>

                  {/* Arrow indicator */}
                  <div className={cn(
                    'hidden md:flex items-center justify-center w-10',
                    'opacity-0 group-hover:opacity-100 transition-opacity'
                  )}>
                    <ArrowRight className={cn(
                      'h-5 w-5',
                      isTerminal ? 'text-primary' : 'text-muted-foreground'
                    )} />
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Index;

function CategorySuggestionsPanel({ isTerminal, activeVisitors }: { isTerminal: boolean; activeVisitors: number }) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-5',
        isTerminal
          ? 'border-primary/30 bg-[hsl(var(--terminal-code-bg))] font-mono'
          : 'border-border/60 bg-card/60 backdrop-blur'
      )}
    >
      <div className='flex items-center justify-between gap-3 mb-4'>
        <div className='min-w-0'>
          <div
            className={cn(
              'text-sm font-semibold',
              isTerminal ? 'text-primary' : 'text-foreground'
            )}
          >
            {isTerminal ? '$ suggested_features' : 'Suggested features'}
          </div>
          <div
            className={cn(
              'text-xs text-muted-foreground',
              isTerminal && 'text-primary/60'
            )}
          >
            {isTerminal ? 'right-pane idea list' : 'Ideas for the right pane'}
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {activeVisitors > 0 && (
            <div
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
                isTerminal
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              )}
              title="현재 접속자 수"
            >
              <span className={cn(
                'w-1.5 h-1.5 rounded-full animate-pulse',
                isTerminal ? 'bg-primary' : 'bg-emerald-500'
              )} />
              {activeVisitors}
            </div>
          )}
          <TrendingUp className={cn('h-4 w-4', isTerminal ? 'text-primary' : 'text-muted-foreground')} />
        </div>
      </div>

      <div className={cn('space-y-2', isTerminal && 'text-sm')}> 
        <div className='flex items-start gap-2'>
          <span className={cn('mt-0.5', isTerminal ? 'text-primary' : 'text-muted-foreground')}>1)</span>
          <div className='min-w-0'>
            <div className={cn('font-medium', isTerminal ? 'text-foreground' : 'text-foreground')}>Trending / Hot Posts</div>
            <div className='text-xs text-muted-foreground'>최근 조회/댓글 기반 TOP N</div>
          </div>
        </div>
        <div className='flex items-start gap-2'>
          <span className={cn('mt-0.5', isTerminal ? 'text-primary' : 'text-muted-foreground')}>2)</span>
          <div className='min-w-0'>
            <div className={cn('font-medium', isTerminal ? 'text-foreground' : 'text-foreground')}>Continue Reading</div>
            <div className='text-xs text-muted-foreground'>최근 본 글 / 마지막 스크롤 위치 복귀</div>
          </div>
        </div>
        <div className='flex items-start gap-2'>
          <span className={cn('mt-0.5', isTerminal ? 'text-primary' : 'text-muted-foreground')}>3)</span>
          <div className='min-w-0'>
            <div className={cn('font-medium', isTerminal ? 'text-foreground' : 'text-foreground')}>Weekly Digest</div>
            <div className='text-xs text-muted-foreground'>이번 주 새 글 + 요약(메일/RSS)</div>
          </div>
        </div>
        <div className='flex items-start gap-2'>
          <span className={cn('mt-0.5', isTerminal ? 'text-primary' : 'text-muted-foreground')}>4)</span>
          <div className='min-w-0'>
            <div className={cn('font-medium', isTerminal ? 'text-foreground' : 'text-foreground')}>AI Quick Actions</div>
            <div className='text-xs text-muted-foreground'>"이 블로그에서 X 찾아줘" 프롬프트 버튼</div>
          </div>
        </div>
      </div>

      <div className={cn('mt-4 pt-3 border-t text-xs', isTerminal ? 'border-primary/20 text-primary/70' : 'border-border/60 text-muted-foreground')}>
        {isTerminal ? 'hint: future widgets can live here' : 'This area can host future widgets.'}
      </div>
    </div>
  );
}
