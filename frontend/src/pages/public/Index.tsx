import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen } from 'lucide-react';
import { PostCard } from '@/components';
import {
  getTags,
  getPosts,
  getPostsPage,
  getPostBySlug,
  getPostCategoryCounts,
} from '@/data/content/posts';
import type { BlogPost, BlogTag } from '@/types/blog';
import { SearchBar } from '@/components/features/search/SearchBar';
import { site } from '@/config/site';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { getEditorPicks } from '@/services/content/analytics';
import { useSEO } from '@/hooks/seo/useSEO';
import { generateSEOData, generateStructuredData } from '@/utils/seo/seo';
import {
  HomeCategoryStrip,
  HomeEditorPicksSection,
  HomeLatestPostsSection,
  HomeMarkdownCta,
  type HomeCategorySummary,
  type HomeSectionLoadState,
} from '@/components/features/home';
import {
  getSiteContentBlock,
  HOME_AI_CTA_BLOCK_KEY,
  type SiteContentBlock,
} from '@/services/content/site-content';

const Index = () => {
  useSEO(
    generateSEOData(undefined, 'home'),
    generateStructuredData(undefined, 'home')
  );

  const { isTerminal } = useTheme();

  // Latest posts state
  const [latestPosts, setLatestPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All posts for search — loaded lazily on first search interaction
  const [allPosts, setAllPosts] = useState<BlogPost[]>([]);
  const [searchResults, setSearchResults] = useState<BlogPost[] | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchPostsLoaded, setSearchPostsLoaded] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(
    {}
  );
  const [categoryCountsState, setCategoryCountsState] =
    useState<HomeSectionLoadState>('loading');
  const [popularTags, setPopularTags] = useState<BlogTag[]>([]);
  const [homeCtaBlock, setHomeCtaBlock] = useState<SiteContentBlock | null>(
    null
  );
  const [homeCtaState, setHomeCtaState] =
    useState<HomeSectionLoadState>('loading');

  // Editor's Picks
  const [featuredPosts, setFeaturedPosts] = useState<BlogPost[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredNotice, setFeaturedNotice] = useState<string | null>(null);

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

    // loadAllForSearch is intentionally NOT called at mount.
    // Posts are loaded lazily when the user first focuses the search bar.
    // See handleSearchFocus below.

    const loadFeatured = async () => {
      try {
        setFeaturedLoading(true);
        setFeaturedNotice(null);

        // 1. Try to load from D1 database (analytics-based editor picks)
        const dbPicks = await getEditorPicks(4);
        if (!cancelled && dbPicks.degraded) {
          setFeaturedNotice(
            'Analytics picks are unavailable. Showing curated fallback.'
          );
        }

        if (dbPicks.data.length > 0) {
          // Resolve posts from D1 picks
          const resolved = await Promise.all(
            dbPicks.data.map(async pick => {
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
            .slice(0, 4);
          if (filtered.length > 0) {
            setFeaturedPosts(filtered);
            return;
          }
        }

        // 3. Final fallback: Latest posts
        const res = await getPostsPage({
          page: 1,
          pageSize: 4,
          sort: 'date',
        });
        setFeaturedPosts(res.items);
      } catch {
        if (!cancelled) {
          setFeaturedNotice(
            'Analytics picks are unavailable. Showing recent posts instead.'
          );
        }
        // Fallback to latest posts on error
        try {
          const res = await getPostsPage({
            page: 1,
            pageSize: 4,
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

    const loadCategoryCounts = async () => {
      try {
        setCategoryCountsState('loading');
        const counts = await getPostCategoryCounts();
        if (!cancelled) {
          setCategoryCounts(counts);
          setCategoryCountsState('ready');
        }
      } catch {
        if (!cancelled) {
          setCategoryCounts({});
          setCategoryCountsState('error');
        }
      }
    };

    const loadPopularTags = async () => {
      try {
        const tags = await getTags();
        if (!cancelled) {
          setPopularTags(
            tags
              .slice()
              .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
              .slice(0, 6)
          );
        }
      } catch {
        if (!cancelled) setPopularTags([]);
      }
    };

    const loadHomeCta = async () => {
      try {
        setHomeCtaState('loading');
        const block = await getSiteContentBlock(HOME_AI_CTA_BLOCK_KEY);
        if (!cancelled) {
          setHomeCtaBlock(block);
          setHomeCtaState('ready');
        }
      } catch {
        if (!cancelled) {
          setHomeCtaBlock(null);
          setHomeCtaState('error');
        }
      }
    };

    loadLatest();
    loadFeatured();
    loadCategoryCounts();
    loadPopularTags();
    loadHomeCta();

    return () => {
      cancelled = true;
    };
  }, []);

  // Lazy-load all posts only when the user first interacts with the search bar.
  const handleSearchFocus = useCallback(async () => {
    if (searchPostsLoaded) return;
    setSearchPostsLoaded(true);
    try {
      const posts = await getPosts();
      setAllPosts(posts);
    } catch {
      // silently ignore — search will just have no results
    }
  }, [searchPostsLoaded]);

  // Featured categories with dynamic counts from allPosts (normalized)
  const categories = useMemo<HomeCategorySummary[]>(() => {
    const entries = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6);

    const fallbackEntries: Array<[string, number]> = [
      ['AI Engineering', 0],
      ['DevOps', 0],
      ['Linux', 0],
      ['Network', 0],
      ['Java', 0],
      ['Web', 0],
    ];

    const sourceEntries = entries.length > 0 ? entries : fallbackEntries;

    return sourceEntries.map(([name, count]) => {
      return {
        name,
        count,
      };
    });
  }, [categoryCounts]);

  return (
    <div className='bg-[hsl(var(--blog-page))]'>
      <div className='mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8'>
        {/* ============================================
          Hero Section - Split Layout with Featured Post
          ============================================ */}
        <section className='mb-16 pt-4 sm:pt-8'>
          <div className='mx-auto max-w-2xl space-y-6 text-center'>
            <div className='space-y-3'>
              <p
                className={cn(
                  'my-0 text-xs font-semibold uppercase tracking-[0.22em] animate-hero-fade-up sm:text-sm',
                  isTerminal
                    ? 'text-primary font-mono'
                    : 'text-muted-foreground'
                )}
                style={{ '--anim-delay': '0ms' } as React.CSSProperties}
              >
                {isTerminal ? '> WELCOME_TO' : 'Welcome to'}
              </p>
              <h1
                className={cn(
                  'my-0 text-5xl font-extrabold leading-[0.98] tracking-tight animate-hero-fade-up sm:text-6xl lg:text-7xl',
                  isTerminal && 'font-mono'
                )}
                style={{ '--anim-delay': '80ms' } as React.CSSProperties}
              >
                <span
                  className={cn(
                    isTerminal
                      ? 'text-foreground'
                      : 'bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent'
                  )}
                >
                  Architecting
                </span>
                <br />
                <span
                  className={cn(
                    isTerminal
                      ? 'text-primary terminal-glow'
                      : 'bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent'
                  )}
                >
                  Intelligence
                </span>
              </h1>
            </div>
            <p
              className={cn(
                'mx-auto max-w-xl text-base leading-7 animate-hero-fade-up sm:text-lg',
                isTerminal ? 'text-muted-foreground' : 'text-muted-foreground'
              )}
              style={{ '--anim-delay': '160ms' } as React.CSSProperties}
            >
              AI, 시스템 설계, 그리고 코드의 본질을 탐구하는 기술 블로그
            </p>

            {/* Search Bar */}
            <div
              className='mx-auto max-w-[31rem] animate-hero-fade-up'
              style={{ '--anim-delay': '240ms' } as React.CSSProperties}
            >
              <SearchBar
                posts={allPosts}
                onSearchResults={results => {
                  setSearchResults(results);
                  setSearchActive(results !== allPosts);
                }}
                onFocus={handleSearchFocus}
                placeholder='Search posts, tags, categories...'
              />
            </div>

            {/* CTA Buttons */}
            <div
              className='flex flex-wrap gap-3 justify-center pt-2 animate-hero-fade-up'
              style={{ '--anim-delay': '320ms' } as React.CSSProperties}
            >
              <Button
                asChild
                size='lg'
                variant={isTerminal ? 'terminal-active' : 'default'}
                className={cn(
                  'h-11 rounded-lg px-6 shadow-[var(--blog-shadow-soft)] transition-transform duration-200 ease-spring active:scale-[0.98]',
                  isTerminal &&
                    'shadow-[0_0_16px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)]'
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
                  'h-11 rounded-lg border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] px-6 shadow-none transition-transform duration-200 ease-spring active:scale-[0.98]',
                  isTerminal &&
                    'font-mono border-border text-foreground hover:border-primary hover:text-primary'
                )}
              >
                <Link to='/about'>
                  About Me
                  <ArrowRight className='ml-2 h-5 w-5' />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ============================================
          Search Results Section
          ============================================ */}
        {searchActive && searchResults && (
          <section className='mb-16'>
            <div className='flex items-center justify-between mb-6'>
              <h2
                className={cn('text-2xl font-bold', isTerminal && 'font-mono')}
              >
                {isTerminal ? '> search_results' : 'Search Results'}
              </h2>
              <div className='text-sm text-muted-foreground'>
                {searchResults.length} match
                {searchResults.length === 1 ? '' : 'es'}
              </div>
            </div>
            <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
              {searchResults.slice(0, 9).map(post => (
                <PostCard
                  key={`${post.year}/${post.slug}`}
                  post={post}
                  variant='grid'
                />
              ))}
            </div>
          </section>
        )}

        <HomeEditorPicksSection
          posts={featuredPosts}
          state={featuredLoading ? 'loading' : 'ready'}
          notice={featuredNotice}
          isTerminal={isTerminal}
        />

        <HomeCategoryStrip
          categories={categories}
          state={categoryCountsState}
          isTerminal={isTerminal}
        />

        <HomeLatestPostsSection
          posts={latestPosts}
          tags={popularTags}
          state={error ? 'error' : loading ? 'loading' : 'ready'}
          error={error}
          isTerminal={isTerminal}
        />

        <HomeMarkdownCta
          block={homeCtaBlock}
          state={homeCtaState}
          isTerminal={isTerminal}
        />
      </div>
    </div>
  );
};

export default Index;
