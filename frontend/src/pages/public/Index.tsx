import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PostCard } from '@/components';
import { FieldnotesPostsSection } from './home/FieldnotesPostsSection';
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
    description: sanitizeDisplayText(post.description),
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPostsLoaded, setSearchPostsLoaded] = useState(false);
  const [searchLoadState, setSearchLoadState] = useState<
    'idle' | HomeSectionLoadState
  >('idle');
  const searchLoadRef = useRef<Promise<void> | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
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
  const [featuredError, setFeaturedError] = useState(false);
  const [featuredNotice, setFeaturedNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadLatest = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getPostsPage(
          { page: 1, pageSize: 3, sort: 'date' },
          { throwOnError: true }
        );
        if (!cancelled) setLatestPosts(res.items);
      } catch {
        if (!cancelled)
          setError(
            '최신 글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
          );
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
        setFeaturedError(false);
        setFeaturedNotice(null);

        // 1. Try to load from D1 database (analytics-based editor picks)
        const dbPicks = await getEditorPicks(4);
        if (!cancelled && dbPicks.degraded) {
          setFeaturedNotice(
            '추천 글을 갱신하지 못해 준비된 글을 보여드립니다.'
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
            if (!cancelled) setFeaturedPosts(filtered);
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
            if (!cancelled) setFeaturedPosts(filtered);
            return;
          }
        }

        // 3. Final fallback: Latest posts
        const res = await getPostsPage(
          {
            page: 1,
            pageSize: 4,
            sort: 'date',
          },
          { throwOnError: true }
        );
        if (!cancelled) setFeaturedPosts(res.items);
      } catch {
        if (!cancelled) {
          setFeaturedNotice('추천 글을 불러오지 못해 최신 글을 보여드립니다.');
        }
        // Fallback to latest posts on error
        try {
          const res = await getPostsPage(
            {
              page: 1,
              pageSize: 4,
              sort: 'date',
            },
            { throwOnError: true }
          );
          if (!cancelled) setFeaturedPosts(res.items);
        } catch {
          if (!cancelled) {
            setFeaturedPosts([]);
            setFeaturedError(true);
            setFeaturedNotice(null);
          }
        }
      } finally {
        if (!cancelled) setFeaturedLoading(false);
      }
    };

    const loadCategoryCounts = async () => {
      try {
        setCategoryCountsState('loading');
        const counts = await getPostCategoryCounts({ throwOnError: true });
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
        const tags = await getTags({ throwOnError: true });
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
  }, [loadAttempt]);

  // Lazy-load all posts only when the user first interacts with the search bar.
  const handleSearchFocus = useCallback(() => {
    if (searchPostsLoaded || searchLoadRef.current) return;
    setSearchLoadState('loading');
    searchLoadRef.current = getPosts({ throwOnError: true })
      .then(posts => {
        setAllPosts(posts);
        setSearchPostsLoaded(true);
        setSearchLoadState('ready');
      })
      .catch(() => setSearchLoadState('error'))
      .finally(() => {
        searchLoadRef.current = null;
      });
  }, [searchPostsLoaded]);

  const handleSearchResults = useCallback(
    (results: BlogPost[]) => {
      setSearchResults(results);
      setSearchActive(results !== allPosts);
    },
    [allPosts]
  );

  // Featured categories with dynamic counts from allPosts (normalized)
  const categories = useMemo<HomeCategorySummary[]>(() => {
    const entries = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6);

    return entries.map(([name, count]) => {
      return {
        name,
        count,
      };
    });
  }, [categoryCounts]);

  const visibleSearchResults = useMemo(() => {
    if (!searchResults) return null;
    return searchResults
      .map(sanitizeSearchResultPost)
      .filter((post): post is BlogPost => post !== null);
  }, [searchResults]);

  return (
    <div className='ui-home fn-home'>
      <PageContainer className='ui-home__container fn-shell fn-page-space'>
        <section className='fn-home-hero' aria-labelledby='home-title'>
          <div className='fn-home-intro'>
            <div className='fn-home-heading'>
              <p className='fn-eyebrow'>AN OPEN NOTEBOOK / WELCOME TO</p>
              <h1 id='home-title'>
                {isTerminal ? (
                  '> engineering_notes'
                ) : (
                  <>
                    <span>Architecting</span>
                    <br />
                    <span>Intelligence</span>
                  </>
                )}
              </h1>
            </div>
            <p className='fn-home-description'>
              AI, 시스템 설계, 그리고 코드의 본질을
              <br />
              탐구하는 기술 블로그
            </p>
            <div className='ui-home__search fn-home-search'>
              <SearchBar
                posts={allPosts}
                onSearchResults={handleSearchResults}
                onQueryChange={setSearchQuery}
                onFocus={handleSearchFocus}
                label='블로그 글 검색'
                inputLabel='검색어'
                clearLabel='검색어 지우기'
                placeholder='제목, 태그, 주제로 글 검색'
              />
              <p className='ui-home__search-help'>
                관심 있는 기술이나 키워드로 기록을 찾아보세요.
              </p>
              {searchLoadState === 'loading' && (
                <ContentStatus kind='loading'>
                  검색할 글을 불러오는 중입니다.
                </ContentStatus>
              )}
              {searchLoadState === 'error' && (
                <ContentStatus kind='error'>
                  검색할 글을 불러오지 못했습니다.{' '}
                  <button
                    type='button'
                    className='ui-inline-link'
                    onClick={handleSearchFocus}
                  >
                    검색 다시 시도
                  </button>
                </ContentStatus>
              )}
            </div>
            <div className='fn-home-cta'>
              <Link to='/blog' className='ui-action' data-ui-variant='default'>
                글 둘러보기 ↗
              </Link>
              <Link to='/about' className='ui-action'>
                About me
              </Link>
            </div>
          </div>
        </section>
        {searchActive &&
          visibleSearchResults &&
          searchLoadState !== 'loading' &&
          searchLoadState !== 'error' && (
            <section
              className='ui-home__section'
              aria-labelledby='home-search-title'
            >
              <PageHeader
                level={2}
                id='home-search-title'
                title={isTerminal ? '> search_results' : 'Search Results'}
                actions={
                  <span className='ui-result-count' role='status'>
                    {visibleSearchResults.length} match
                    {visibleSearchResults.length === 1 ? '' : 'es'}
                  </span>
                }
              />
              {visibleSearchResults.length === 0 ? (
                <ContentStatus kind='empty'>
                  검색 결과가 없습니다. 검색어를 바꾸거나 지워 다시 확인하세요.
                </ContentStatus>
              ) : (
                <div className='ui-home__search-results fn-home-search-results'>
                  {visibleSearchResults.slice(0, 9).map(post => (
                    <PostCard
                      key={`${post.year}/${post.slug}`}
                      post={post}
                      variant='list'
                      showTilt={false}
                      className='fn-search-result'
                    />
                  ))}
                </div>
              )}
              {visibleSearchResults.length > 9 && (
                <Link
                  to={`/blog?q=${encodeURIComponent(searchQuery)}`}
                  className='ui-action ui-home__all-results'
                >
                  전체 검색 결과 보기 ({visibleSearchResults.length}개)
                </Link>
              )}
            </section>
          )}
        <FieldnotesPostsSection
          id='home-latest-title'
          eyebrow='FROM THE NOTEBOOK'
          title={isTerminal ? '// latest_posts' : '최근의 기록'}
          posts={latestPosts
            .map(sanitizeSearchResultPost)
            .filter((post): post is BlogPost => post !== null)}
          state={error ? 'error' : loading ? 'loading' : 'ready'}
          error={error}
          onRetry={() => setLoadAttempt(attempt => attempt + 1)}
        />
        <FieldnotesPostsSection
          id='home-picks-title'
          eyebrow='WORTH A SECOND READ'
          title={isTerminal ? '// editor_picks' : "Editor's Picks"}
          posts={featuredPosts
            .map(sanitizeSearchResultPost)
            .filter((post): post is BlogPost => post !== null)}
          state={
            featuredLoading ? 'loading' : featuredError ? 'error' : 'ready'
          }
          notice={featuredNotice}
          onRetry={() => setLoadAttempt(attempt => attempt + 1)}
        />
        {popularTags.length > 0 && (
          <nav className='fn-home-topics' aria-label='인기 태그'>
            <span className='fn-eyebrow'>POPULAR TAGS</span>
            {popularTags.slice(0, 6).map(tag => (
              <Link
                key={tag.name}
                to={`/blog?tag=${encodeURIComponent(tag.name)}`}
              >
                #{tag.name} <span>{tag.count}</span>
              </Link>
            ))}
          </nav>
        )}
        <HomeCategoryStrip
          categories={categories}
          state={categoryCountsState}
          isTerminal={isTerminal}
        />
        <HomeMarkdownCta
          block={homeCtaBlock}
          state={homeCtaState}
          isTerminal={isTerminal}
        />
      </PageContainer>
    </div>
  );
};

export default Index;
