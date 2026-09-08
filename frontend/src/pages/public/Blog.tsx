import { ResponsiveFilterPanel } from '@/components/organisms/layout';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  BlogSkeletonFeatured,
  BlogSkeletonSpotlight,
  BlogSkeletonList,
} from '@/components/features/blog';
import { Pagination } from '@/components';
import {
  getPostsPage,
  getAllCategories,
  getAllTags,
} from '@/data/content/posts';
import { BlogPost, PostsPage } from '@/types/blog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Search,
  X,
} from 'lucide-react';
import { useDebounce } from '@/hooks/core/useDebounce';
import { formatDate } from '@/utils/content/blog';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { useSEO } from '@/hooks/seo/useSEO';
import { generateSEOData, generateStructuredData } from '@/utils/seo/seo';
import { cn } from '@/lib/utils';
import { ContentStatus } from '@/components/molecules/ContentStatus';

const POSTS_PER_PAGE = 12;
const TAGS_PER_PAGE = 20;
const BLOG_LIST_PATH_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;

function decodeBlogListPathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeBlogListPathSegment(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const raw = String(value).trim();
  const decoded = decodeBlogListPathSegment(raw);
  if (
    !raw ||
    !decoded ||
    raw.includes('/') ||
    raw.includes('\\') ||
    decoded.includes('/') ||
    decoded.includes('\\') ||
    BLOG_LIST_PATH_CONTROL_PATTERN.test(raw) ||
    BLOG_LIST_PATH_CONTROL_PATTERN.test(decoded)
  ) {
    return null;
  }

  return encodeURIComponent(raw);
}

export function buildBlogListPostPath(
  post: Pick<BlogPost, 'year' | 'slug'>
): string {
  const year = normalizeBlogListPathSegment(post.year);
  const slug = normalizeBlogListPathSegment(post.slug);
  return year && slug ? `/blog/${year}/${slug}` : '/blog';
}

const Blog = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');

  useSEO(
    generateSEOData(undefined, 'blog', { category: categoryParam }),
    generateStructuredData(undefined, 'blog')
  );
  const pageParam = Number(searchParams.get('page') || 1);
  const currentPage =
    Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const selectedCategory = categoryParam || 'all';
  const searchTerm = searchParams.get('q') || '';
  const tagKey = JSON.stringify(searchParams.getAll('tag').filter(Boolean));
  const selectedTags = useMemo<string[]>(
    () => Array.from(new Set<string>(JSON.parse(tagKey))),
    [tagKey]
  );
  const sortParam = searchParams.get('sort');
  const sortBy =
    sortParam === 'title' || sortParam === 'readTime' ? sortParam : 'date';

  const [pageData, setPageData] = useState<PostsPage<BlogPost>>({
    items: [],
    page: 1,
    pageSize: POSTS_PER_PAGE,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [metadataState, setMetadataState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [categories, setCategories] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showAllTags, setShowAllTags] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [tagPage, setTagPage] = useState(1);

  // Debounce search term to avoid excessive filtering
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const resultsPending = loading || searchTerm !== debouncedSearchTerm;
  const debouncedTagSearch = useDebounce(tagSearchTerm, 200);

  // Filter and paginate tags
  const filteredTags = useMemo(() => {
    if (!debouncedTagSearch) return allTags;
    const lower = debouncedTagSearch.toLowerCase();
    return allTags.filter(tag => tag.toLowerCase().includes(lower));
  }, [allTags, debouncedTagSearch]);

  const totalTagPages = Math.ceil(filteredTags.length / TAGS_PER_PAGE);
  const displayedTags = useMemo(() => {
    const start = (tagPage - 1) * TAGS_PER_PAGE;
    return filteredTags.slice(start, start + TAGS_PER_PAGE);
  }, [filteredTags, tagPage]);

  // Reset tag page when search changes
  useEffect(() => {
    setTagPage(1);
  }, [debouncedTagSearch]);

  // Load a page of posts (metadata-only) whenever filters/sort/page change
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) return;
    let cancelled = false;
    const loadPage = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getPostsPage({
          page: currentPage,
          pageSize: POSTS_PER_PAGE,
          category: selectedCategory,
          tags: selectedTags,
          search: debouncedSearchTerm,
          sort: sortBy as 'date' | 'title' | 'readTime',
        }, { throwOnError: true });
        if (!cancelled) setPageData(res);
      } catch (error) {
        console.error('Failed to load posts page:', error);
        if (!cancelled)
          setError('글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadPage();
    return () => {
      cancelled = true;
    };
  }, [
    searchTerm,
    debouncedSearchTerm,
    selectedCategory,
    selectedTags,
    sortBy,
    currentPage,
    retryAttempt,
  ]);

  // Load global metadata (categories, tags, total posts)
  useEffect(() => {
    let cancelled = false;
    const loadMeta = async () => {
      try {
        setMetadataState('loading');
        const [cats, tags] = await Promise.all([
          getAllCategories({ throwOnError: true }),
          getAllTags({ throwOnError: true }),
        ]);
        if (cancelled) return;
        setCategories(cats.sort());
        setAllTags(tags.sort());
        setMetadataState('ready');
      } catch {
        if (!cancelled) setMetadataState('error');
      }
    };
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [retryAttempt]);

  // Pagination info from server
  const totalPages = pageData.totalPages;

  const updateFilters = useCallback(
    (change: (params: URLSearchParams) => void, replace = false) => {
      setSearchParams(
        prev => {
          const params = new URLSearchParams(prev);
          change(params);
          params.delete('page');
          return params;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  const setSearchTerm = useCallback(
    (query: string) => {
      updateFilters(params => {
        if (query) params.set('q', query);
        else params.delete('q');
      }, true);
    },
    [updateFilters]
  );

  const handleTagToggle = useCallback(
    (tag: string) => {
      updateFilters(params => {
        const currentTags = params.getAll('tag');
        const tags = currentTags.includes(tag)
          ? currentTags.filter(value => value !== tag)
          : [...currentTags, tag];
        params.delete('tag');
        tags.forEach(value => params.append('tag', value));
      });
    },
    [updateFilters]
  );

  const handleClearTagFilters = useCallback(() => {
    updateFilters(params => params.delete('tag'));
  }, [updateFilters]);

  const clearFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const handleCategoryChange = useCallback(
    (category: string) => {
      updateFilters(params => {
        if (category === 'all') params.delete('category');
        else params.set('category', category);
      });
    },
    [updateFilters]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        if (page <= 1) {
          params.delete('page');
        } else {
          params.set('page', page.toString());
        }
        return params;
      });
      // Scroll to top when page changes
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      });
    },
    [setSearchParams]
  );

  const hasActiveFilters = Boolean(
    searchTerm.trim() || selectedCategory !== 'all' || selectedTags.length
  );
  const showEditorial =
    !hasActiveFilters && currentPage === 1 && sortBy === 'date';
  const featuredPost = showEditorial ? pageData.items[0] : undefined;
  const spotlightPosts = showEditorial ? pageData.items.slice(1, 3) : [];
  const listPosts = showEditorial ? pageData.items.slice(3) : pageData.items;
  const visibleCategories = Array.from(
    new Set([
      ...categories,
      ...(selectedCategory === 'all' ? [] : [selectedCategory]),
    ])
  );
  const renderPostImage = (
    post: BlogPost,
    className: string,
    fallbackLabel = '기술 기록'
  ) => (
    <div
      className={cn(
        'ui-post-thumbnail overflow-hidden rounded-lg bg-[hsl(var(--blog-surface-muted))]',
        className
      )}
    >
      {post.coverImage ? (
        <OptimizedImage
          src={post.coverImage}
          alt={post.title}
          className='h-full w-full object-cover transition-transform duration-300 ease-smooth'
        />
      ) : (
        <div className='flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground'>
          <BookOpen
            aria-hidden='true'
            className='h-7 w-7 text-muted-foreground/50'
          />
          <span className='text-xs'>{fallbackLabel}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className='ui-page ui-blog-page' data-ui-page='blog'>
      <div className='ui-page-container ui-blog-layout'>
        <header className='ui-blog-heading'>
          <div>
            <p className='my-0 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground'>
              Discover
            </p>
            <h1 className='my-0 mt-3 text-3xl font-bold tracking-tight text-[hsl(var(--blog-title))] sm:text-4xl'>
              Blog Posts
            </h1>
            <p className='ui-discovery-intro'>
              AI부터 시스템 운영까지, 주제별로 살펴보는 기술 기록
            </p>
          </div>
          <div className='relative'>
            <Search
              aria-hidden='true'
              className='absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
            />
            <Input
              type='search'
              placeholder='제목, 태그, 내용으로 검색'
              aria-label='게시글 검색'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='ui-input h-12 rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] pl-12 text-sm shadow-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/60 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20'
            />
          </div>
        </header>

        <ResponsiveFilterPanel
          label='필터 및 태그'
          activeCount={
            selectedTags.length + (selectedCategory === 'all' ? 0 : 1)
          }
        >
          <section className='ui-blog-filters' aria-label='게시글 필터'>
            <div className='flex flex-wrap items-center gap-2'>
              {['All', ...visibleCategories.slice(0, 5)].map(category => {
                const isActive =
                  (category === 'All' && selectedCategory === 'all') ||
                  category === selectedCategory;
                return (
                  <button
                    key={category}
                    type='button'
                    aria-pressed={isActive}
                    onClick={() =>
                      category === 'All'
                        ? handleCategoryChange('all')
                        : handleCategoryChange(category)
                    }
                    className={cn(
                      'flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-medium transition-[background-color,border-color,color,transform] duration-200 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] text-muted-foreground hover:border-primary/40 hover:text-primary'
                    )}
                  >
                    {category}
                  </button>
                );
              })}
              {allTags.length > 0 && (
                <button
                  type='button'
                  className='flex min-h-11 items-center gap-1 rounded-full border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] px-4 text-sm font-medium text-muted-foreground transition-[border-color,color,transform] duration-200 ease-spring hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
                  onClick={() => {
                    setShowAllTags(v => !v);
                    if (!showAllTags) {
                      setTagPage(1);
                      setTagSearchTerm('');
                    }
                  }}
                  aria-expanded={showAllTags}
                  aria-controls='blog-tag-options'
                >
                  {showAllTags ? (
                    <>
                      <ChevronUp aria-hidden='true' className='h-4 w-4' />
                      태그 닫기
                    </>
                  ) : (
                    <>
                      <ChevronDown aria-hidden='true' className='h-4 w-4' />
                      태그 선택 ({allTags.length})
                    </>
                  )}
                </button>
              )}
            </div>

            <div className='ui-discovery-fields'>
              <label className='ui-label' htmlFor='blog-category'>
                전체 주제
              </label>
              <select
                id='blog-category'
                className='ui-input ui-discovery-select'
                value={selectedCategory}
                onChange={event => handleCategoryChange(event.target.value)}
              >
                <option value='all'>모든 주제</option>
                {visibleCategories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <label className='ui-label' htmlFor='blog-sort'>
                정렬
              </label>
              <select
                id='blog-sort'
                className='ui-input ui-discovery-select'
                value={sortBy}
                onChange={event =>
                  updateFilters(params => {
                    if (event.target.value === 'date') params.delete('sort');
                    else params.set('sort', event.target.value);
                  })
                }
              >
                <option value='date'>최신 글 먼저</option>
                <option value='title'>제목 순</option>
                <option value='readTime'>짧은 글 먼저</option>
              </select>
            </div>
            {metadataState === 'loading' && (
              <ContentStatus kind='loading'>
                주제와 태그를 불러오는 중입니다.
              </ContentStatus>
            )}
            {metadataState === 'error' && (
              <ContentStatus kind='error'>
                주제와 태그를 불러오지 못했습니다.{' '}
                <button
                  type='button'
                  className='ui-plain-button'
                  onClick={() => setRetryAttempt(attempt => attempt + 1)}
                >
                  다시 시도
                </button>
              </ContentStatus>
            )}

            {selectedTags.length > 0 && (
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-xs text-muted-foreground'>
                  선택한 태그
                </span>
                {selectedTags.map(tag => (
                  <Button
                    data-ui-variant='default'
                    type='button'
                    key={tag}
                    variant='default'
                    className='ui-control flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-4 py-2 text-sm'
                    onClick={() => handleTagToggle(tag)}
                    aria-label={`${tag} 태그 필터 해제`}
                  >
                    #{tag}
                    <X aria-hidden='true' className='h-3 w-3' />
                  </Button>
                ))}
                <button
                  type='button'
                  className='flex min-h-11 min-w-11 items-center rounded-md px-2 text-xs text-muted-foreground underline transition-colors hover:text-foreground'
                  onClick={handleClearTagFilters}
                >
                  태그 모두 해제
                </button>
              </div>
            )}

            {showAllTags && (
              <div
                id='blog-tag-options'
                className='space-y-3 rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] p-4'
              >
                <div className='relative'>
                  <Search
                    aria-hidden='true'
                    className='absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground'
                  />
                  <Input
                    type='text'
                    aria-label='태그 검색'
                    placeholder='태그 이름 검색'
                    value={tagSearchTerm}
                    onChange={e => setTagSearchTerm(e.target.value)}
                    className='ui-input h-12 rounded-lg border-[hsl(var(--blog-border))] pl-9 pr-12 text-sm'
                  />
                  {tagSearchTerm && (
                    <button
                      type='button'
                      className='absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                      onClick={() => setTagSearchTerm('')}
                      aria-label='태그 검색어 지우기'
                    >
                      <X aria-hidden='true' className='h-3.5 w-3.5' />
                    </button>
                  )}
                </div>

                {displayedTags.length > 0 ? (
                  <div className='flex flex-wrap gap-2'>
                    {displayedTags.map(tag => (
                      <Button
                        data-ui-variant={
                          selectedTags.includes(tag) ? 'default' : 'outline'
                        }
                        type='button'
                        key={tag}
                        variant={
                          selectedTags.includes(tag) ? 'default' : 'outline'
                        }
                        className='ui-control flex min-h-11 cursor-pointer items-center rounded-full px-4 py-2 text-sm transition-transform duration-200 ease-spring'
                        onClick={() => handleTagToggle(tag)}
                        aria-pressed={selectedTags.includes(tag)}
                      >
                        #{tag}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className='py-4 text-center text-sm text-muted-foreground'>
                    No tags found matching "{tagSearchTerm}"
                  </p>
                )}

                {totalTagPages > 1 && (
                  <div className='flex flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--blog-border))] pt-3'>
                    <span className='text-xs text-muted-foreground'>
                      {filteredTags.length} tags found
                    </span>
                    <div className='flex items-center gap-2'>
                      <Button
                        data-ui-variant='ghost'
                        variant='ghost'
                        size='sm'
                        className='ui-control min-h-11 px-2 text-xs'
                        disabled={tagPage <= 1}
                        onClick={() => setTagPage(p => Math.max(1, p - 1))}
                      >
                        Prev
                      </Button>
                      <span className='text-xs text-muted-foreground'>
                        {tagPage} / {totalTagPages}
                      </span>
                      <Button
                        data-ui-variant='ghost'
                        variant='ghost'
                        size='sm'
                        className='ui-control min-h-11 px-2 text-xs'
                        disabled={tagPage >= totalTagPages}
                        onClick={() =>
                          setTagPage(p => Math.min(totalTagPages, p + 1))
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </ResponsiveFilterPanel>

        {featuredPost && !resultsPending && !error && (
          <section className='ui-blog-featured'>
            <div className='rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] p-5 shadow-none'>
              <Link
                to={buildBlogListPostPath(featuredPost)}
                className='group grid gap-7 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:grid-cols-[1.08fr_minmax(0,1fr)]'
                state={{
                  from: {
                    pathname: location.pathname,
                    search: location.search,
                  },
                }}
                data-testid='post-link'
              >
                {renderPostImage(
                  featuredPost,
                  'aspect-[16/9] min-h-[14rem] lg:min-h-[18rem]',
                  'No cover'
                )}
                <div className='flex min-w-0 flex-col justify-center py-1'>
                  <div className='mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground'>
                    <Badge variant='secondary' className='rounded-md px-3 py-1'>
                      {featuredPost.category}
                    </Badge>
                    <span>{formatDate(featuredPost.date)}</span>
                    {featuredPost.readingTime && (
                      <span className='inline-flex items-center gap-1'>
                        <Clock className='h-3.5 w-3.5' />
                        {featuredPost.readingTime}
                      </span>
                    )}
                  </div>
                  <h2 className='my-0 text-2xl font-bold leading-tight tracking-tight text-[hsl(var(--blog-title))] transition-colors group-hover:text-primary sm:text-3xl'>
                    {featuredPost.title}
                  </h2>
                  <p className='mt-5 line-clamp-3 text-base leading-7 text-muted-foreground'>
                    {featuredPost.excerpt || featuredPost.description}
                  </p>
                </div>
              </Link>

              {spotlightPosts.length > 0 && (
                <div className='mt-5 grid gap-5 md:grid-cols-2'>
                  {spotlightPosts.map(post => (
                    <Link
                      key={`${post.year}/${post.slug}`}
                      to={buildBlogListPostPath(post)}
                      className='ui-post-record ui-post-record-compact group'
                      state={{
                        from: {
                          pathname: location.pathname,
                          search: location.search,
                        },
                      }}
                      data-testid='post-link'
                    >
                      {renderPostImage(post, 'h-24 w-full')}
                      <div className='min-w-0 self-center'>
                        <div className='mb-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground'>
                          <span>{post.category}</span>
                          <span>{formatDate(post.date)}</span>
                          {post.readingTime && <span>{post.readingTime}</span>}
                        </div>
                        <h3 className='my-0 line-clamp-2 text-base font-semibold leading-snug text-[hsl(var(--blog-title))] transition-colors group-hover:text-primary'>
                          {post.title}
                        </h3>
                        <p className='mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground'>
                          {post.excerpt || post.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section
          className='ui-blog-results'
          aria-label='게시글 검색 결과'
          aria-busy={resultsPending}
        >
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <h2 className='my-0 text-lg font-semibold text-[hsl(var(--blog-title))]'>
              {hasActiveFilters
                ? '검색 결과'
                : showEditorial && featuredPost
                  ? '이어지는 글'
                  : '모든 글'}
            </h2>
            <p className='ui-result-count' role='status'>
              {resultsPending
                ? '글을 불러오는 중입니다.'
                : error
                  ? '글을 불러오지 못했습니다.'
                  : `총 ${pageData.total.toLocaleString()}개 글${totalPages > 1 ? ` · ${currentPage} / ${totalPages} 페이지` : ''}`}
            </p>
            {hasActiveFilters && (
              <button
                type='button'
                className='ui-plain-button'
                onClick={clearFilters}
              >
                필터 초기화
              </button>
            )}
          </div>

          {resultsPending ? (
            <div className='space-y-5' aria-hidden='true'>
              <BlogSkeletonFeatured />
              <div className='grid gap-5 md:grid-cols-2'>
                <BlogSkeletonSpotlight />
                <BlogSkeletonSpotlight />
              </div>
              <div className='space-y-3'>
                {Array.from({ length: 5 }).map((_, i) => (
                  <BlogSkeletonList key={i} />
                ))}
              </div>
            </div>
          ) : error ? (
            <div
              className='rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-12 text-center'
              role='alert'
            >
              <p className='mb-4 text-destructive'>{error}</p>
              <Button
                className='ui-control'
                data-ui-variant='outline'
                variant='outline'
                onClick={() => setRetryAttempt(attempt => attempt + 1)}
              >
                다시 시도
              </Button>
            </div>
          ) : listPosts.length > 0 ? (
            <div className='ui-post-records'>
              {listPosts.map(post => (
                <Link
                  key={`${post.year}/${post.slug}`}
                  to={buildBlogListPostPath(post)}
                  className='ui-post-record group'
                  state={{
                    from: {
                      pathname: location.pathname,
                      search: location.search,
                    },
                  }}
                  data-testid='post-link'
                >
                  {renderPostImage(post, 'h-20 w-full sm:h-24')}
                  <div className='min-w-0 self-center text-sm'>
                    <div className='mb-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground'>
                      <span>{post.category}</span>
                      <span>{formatDate(post.date)}</span>
                      {post.readingTime && (
                        <span className='inline-flex items-center gap-1 normal-case tracking-normal'>
                          <Clock className='h-3 w-3' />
                          {post.readingTime}
                        </span>
                      )}
                    </div>
                    <h3 className='my-0 line-clamp-2 text-base font-semibold leading-snug text-[hsl(var(--blog-title))] transition-colors group-hover:text-primary'>
                      {post.title}
                    </h3>
                    <p className='mt-1 line-clamp-2 leading-6 text-muted-foreground'>
                      {post.excerpt || post.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : pageData.items.length > 0 ? (
            <p className='ui-discovery-intro'>
              이 페이지의 글을 모두 확인했습니다.
            </p>
          ) : (
            <div
              className='rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] px-4 py-12 text-center'
              role='status'
            >
              <Search
                aria-hidden='true'
                className='mx-auto mb-4 h-14 w-14 text-muted-foreground/40'
              />
              <p className='mb-2 text-lg font-medium'>찾는 글이 없습니다</p>
              <p className='mb-4 text-muted-foreground'>
                {debouncedSearchTerm ||
                selectedCategory !== 'all' ||
                selectedTags.length > 0
                  ? '검색어를 바꾸거나 선택한 주제와 태그를 해제해 보세요.'
                  : '아직 공개된 글이 없습니다.'}
              </p>
              {(hasActiveFilters || currentPage > 1) && (
                <Button
                  className='ui-control'
                  data-ui-variant='outline'
                  variant='outline'
                  onClick={clearFilters}
                >
                  {currentPage > 1 && !hasActiveFilters
                    ? '첫 페이지로'
                    : '필터 초기화'}
                </Button>
              )}
            </div>
          )}

          {!resultsPending && !error && totalPages > 1 && (
            <div className='pt-6'>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                className='justify-center'
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Blog;
