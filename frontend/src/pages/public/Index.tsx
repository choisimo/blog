import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { PageContainer, PageHeader } from '@/components/organisms/layout';
import { ContentStatus } from '@/components/molecules/ContentStatus';
import { useTheme } from '@/contexts/ThemeContext';
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

const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;
const CONTROL_TEXT_DETECTOR = /[\u0000-\u001f\u007f-\u009f]/;
const UNSAFE_BLOG_SEGMENT_PATTERN = /[\\/#?]/;

function sanitizeDisplayText(value: unknown): string {
  return String(value ?? '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();
}

function normalizeBlogPathSegment(value: unknown): string | null {
  const segment = sanitizeDisplayText(value);
  if (!segment || UNSAFE_BLOG_SEGMENT_PATTERN.test(segment)) return null;

  let decodedSegment: string;
  try {
    decodedSegment = decodeURIComponent(segment);
  } catch {
    return null;
  }

  if (
    !decodedSegment ||
    decodedSegment === '.' ||
    decodedSegment === '..' ||
    CONTROL_TEXT_DETECTOR.test(decodedSegment) ||
    UNSAFE_BLOG_SEGMENT_PATTERN.test(decodedSegment)
  ) {
    return null;
  }

  return segment;
}

function sanitizeSearchResultPost(post: BlogPost): BlogPost | null {
  const year = normalizeBlogPathSegment(post.year);
  const slug = normalizeBlogPathSegment(post.slug);
  if (!year || !slug) return null;

  return {
    ...post,
    year,
    slug,
    title: sanitizeDisplayText(post.title),
    category: sanitizeDisplayText(post.category),
    excerpt: sanitizeDisplayText(post.excerpt),
    readingTime: sanitizeDisplayText(post.readingTime),
    tags: Array.isArray(post.tags)
      ? post.tags.map(tag => sanitizeDisplayText(tag)).filter(Boolean)
      : post.tags,
  };
}

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

  const visibleSearchResults = useMemo(() => {
    if (!searchResults) return null;
    return searchResults
      .slice(0, 9)
      .map(sanitizeSearchResultPost)
      .filter((post): post is BlogPost => post !== null);
  }, [searchResults]);

  return (
    <div className="ui-home">
      <PageContainer className="ui-home__container">
        <PageHeader
          eyebrow="Nodove Blog"
          title={isTerminal ? '> engineering_notes' : '코드와 시스템의 기록'}
          description="AI, 시스템 설계, 그리고 코드의 본질을 탐구하는 기술 블로그"
          actions={<Link to="/blog" className="ui-action">모든 글 보기</Link>}
        />
        <div className="ui-home__search" role="search" aria-label="블로그 글 검색">
          <SearchBar posts={allPosts}
            onSearchResults={results => { setSearchResults(results); setSearchActive(results !== allPosts); }}
            onFocus={handleSearchFocus} placeholder="Search posts, tags, categories..." />
        </div>
        {searchActive && visibleSearchResults && (
          <section className="ui-home__section" aria-labelledby="home-search-title">
            <PageHeader level={2} id="home-search-title"
              title={isTerminal ? '> search_results' : 'Search Results'}
              actions={<span className="ui-result-count">{visibleSearchResults.length} match{visibleSearchResults.length === 1 ? '' : 'es'}</span>} />
            {visibleSearchResults.length === 0 ? (
              <ContentStatus kind="empty">검색 결과가 없습니다. 검색어를 바꾸거나 지워 다시 확인하세요.</ContentStatus>
            ) : (
              <div className="ui-home__search-results">
                {visibleSearchResults.map(post => (
                  <PostCard key={`${post.year}/${post.slug}`} post={post} variant="grid" />
                ))}
              </div>
            )}
          </section>
        )}
        <HomeEditorPicksSection posts={featuredPosts} state={featuredLoading ? 'loading' : 'ready'} notice={featuredNotice} isTerminal={isTerminal} />
        <HomeLatestPostsSection posts={latestPosts} tags={popularTags} state={error ? 'error' : loading ? 'loading' : 'ready'} error={error} isTerminal={isTerminal} />
        <HomeCategoryStrip categories={categories} state={categoryCountsState} isTerminal={isTerminal} />
        <HomeMarkdownCta block={homeCtaBlock} state={homeCtaState} isTerminal={isTerminal} />
      </PageContainer>
    </div>
  );
};

export default Index;
