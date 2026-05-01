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

const POSTS_PER_PAGE = 12;
const TAGS_PER_PAGE = 20;

const Blog = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');

  useSEO(
    generateSEOData(undefined, 'blog', { category: categoryParam }),
    generateStructuredData(undefined, 'blog')
  );
  const pageParam = searchParams.get('page');

  const initialCategory = useMemo(
    () => categoryParam ?? 'all',
    [categoryParam]
  );
  const initialPage = useMemo(() => {
    const parsed = pageParam ? parseInt(pageParam, 10) : NaN;
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : 1;
  }, [pageParam]);

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('date');
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [,] = useState<'grid' | 'list'>('grid');
  const [categories, setCategories] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [, setSiteTotalPosts] = useState(0);
  const [showAllTags, setShowAllTags] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [tagPage, setTagPage] = useState(1);

  // Debounce search term to avoid excessive filtering
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
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

  const syncStateFromParams = useCallback(
    (nextCategory: string, nextPage: number) => {
      setSelectedCategory(nextCategory);
      setCurrentPage(nextPage);
    },
    []
  );

  // Sync URL -> state whenever params change
  useEffect(() => {
    const paramsCategory = searchParams.get('category') || 'all';
    const paramsPageRaw = searchParams.get('page');
    const paramsPage = paramsPageRaw
      ? Math.max(1, parseInt(paramsPageRaw, 10))
      : 1;

    if (paramsCategory !== selectedCategory || paramsPage !== currentPage) {
      syncStateFromParams(paramsCategory, paramsPage);
    }
  }, [searchParams, selectedCategory, currentPage, syncStateFromParams]);

  // Load a page of posts (metadata-only) whenever filters/sort/page change
  useEffect(() => {
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
        });
        if (!cancelled) setPageData(res);
      } catch (error) {
        console.error('Failed to load posts page:', error);
        if (!cancelled)
          setError('Failed to load blog posts. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadPage();
    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearchTerm,
    selectedCategory,
    selectedTags,
    sortBy,
    currentPage,
  ]);

  // Load global metadata (categories, tags, total posts)
  useEffect(() => {
    let cancelled = false;
    const loadMeta = async () => {
      try {
        const [cats, tags, totalPage] = await Promise.all([
          getAllCategories(),
          getAllTags(),
          getPostsPage({ page: 1, pageSize: 1 }),
        ]);
        if (cancelled) return;
        setCategories(cats.sort());
        setAllTags(tags.sort());
        setSiteTotalPosts(totalPage.total);
      } catch {
        // ignore meta errors
      }
    };
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pagination info from server
  const totalPages = pageData.totalPages;

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleClearTagFilters = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedTags([]);
    setSortBy('date');
    setCurrentPage(1);
    setSearchParams({});
  }, [setSearchParams]);

  const handleCategoryChange = useCallback(
    (category: string) => {
      setSelectedCategory(category);
      setCurrentPage(1);
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        if (!category || category === 'all') {
          params.delete('category');
        } else {
          params.set('category', category);
        }
        params.delete('page');
        return params;
      });
    },
    [setSearchParams]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setSearchParams]
  );

  const featuredPost = pageData.items[0];
  const spotlightPosts = pageData.items.slice(1, 3);
  const listPosts = pageData.items.slice(3);
  const renderPostImage = (
    post: BlogPost,
    className: string,
    fallbackLabel = 'No image'
  ) => (
    <div
      className={cn(
        'overflow-hidden rounded-lg bg-[hsl(var(--blog-surface-muted))]',
        className
      )}
    >
      {post.coverImage ? (
        <OptimizedImage
          src={post.coverImage}
          alt={post.title}
          className='h-full w-full object-cover transition-transform duration-300 ease-smooth group-hover:scale-[1.03]'
        />
      ) : (
        <div className='flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground'>
          <BookOpen className='h-7 w-7 text-muted-foreground/50' />
          <span className='text-xs'>{fallbackLabel}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className='min-h-screen bg-[hsl(var(--blog-page))]'>
      <div className='mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8'>
        <header className='mb-7 space-y-5'>
          <div>
            <p className='my-0 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground'>
              Discover
            </p>
            <h1 className='my-0 mt-3 text-3xl font-bold tracking-tight text-[hsl(var(--blog-title))] sm:text-4xl'>
              Blog Posts
            </h1>
          </div>
          <div className='relative'>
            <Search className='absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              type='text'
              placeholder='Search posts, tags, or content...'
              aria-label='Search posts'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='h-12 rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] pl-12 text-sm shadow-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/60 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20'
            />
          </div>
        </header>

        <section className='mb-8 space-y-3'>
          <div className='flex flex-wrap items-center gap-2'>
            {['All', ...categories.slice(0, 5)].map(category => {
              const isActive =
                (category === 'All' && selectedCategory === 'all') ||
                category === selectedCategory;
              return (
                <button
                  key={category}
                  type='button'
                  onClick={() =>
                    category === 'All'
                      ? handleCategoryChange('all')
                      : handleCategoryChange(category)
                  }
                  className={cn(
                    'flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-medium transition-[background-color,border-color,color,transform] duration-200 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground shadow-[var(--blog-shadow-soft)]'
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
                className='flex min-h-11 items-center gap-1 rounded-full border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] px-4 text-sm font-medium text-muted-foreground transition-[border-color,color,transform] duration-200 ease-spring hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]'
                onClick={() => {
                  setShowAllTags(v => !v);
                  if (!showAllTags) {
                    setTagPage(1);
                    setTagSearchTerm('');
                  }
                }}
                aria-expanded={showAllTags}
              >
                {showAllTags ? (
                  <>
                    <ChevronUp className='h-4 w-4' />
                    Hide tags
                  </>
                ) : (
                  <>
                    <ChevronDown className='h-4 w-4' />
                    More tags ({allTags.length})
                  </>
                )}
              </button>
            )}
          </div>

          {selectedTags.length > 0 && (
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs text-muted-foreground'>
                Filtered by:
              </span>
              {selectedTags.map(tag => (
                <Badge
                  key={tag}
                  variant='default'
                  className='flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-4 py-2 text-sm'
                  onClick={() => handleTagToggle(tag)}
                >
                  #{tag}
                  <X className='h-3 w-3' />
                </Badge>
              ))}
              <button
                type='button'
                className='flex min-h-9 items-center rounded-md px-2 text-xs text-muted-foreground underline transition-colors hover:text-foreground'
                onClick={handleClearTagFilters}
              >
                Clear all
              </button>
            </div>
          )}

          {showAllTags && (
            <div className='space-y-3 rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] p-4 shadow-[var(--blog-shadow-soft)]'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
                <Input
                  type='text'
                  placeholder='Search tags...'
                  value={tagSearchTerm}
                  onChange={e => setTagSearchTerm(e.target.value)}
                  className='h-10 rounded-lg border-[hsl(var(--blog-border))] pl-9 text-sm'
                />
                {tagSearchTerm && (
                  <button
                    type='button'
                    className='absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                    onClick={() => setTagSearchTerm('')}
                    aria-label='Clear tag search'
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                )}
              </div>

              {displayedTags.length > 0 ? (
                <div className='flex flex-wrap gap-2'>
                  {displayedTags.map(tag => (
                    <Badge
                      key={tag}
                      variant={
                        selectedTags.includes(tag) ? 'default' : 'outline'
                      }
                      className='flex min-h-11 cursor-pointer items-center rounded-full px-4 py-2 text-sm transition-transform duration-200 ease-spring active:scale-[0.98]'
                      onClick={() => handleTagToggle(tag)}
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className='py-4 text-center text-sm text-muted-foreground'>
                  No tags found matching "{tagSearchTerm}"
                </p>
              )}

              {totalTagPages > 1 && (
                <div className='flex items-center justify-between border-t border-[hsl(var(--blog-border))] pt-3'>
                  <span className='text-xs text-muted-foreground'>
                    {filteredTags.length} tags found
                  </span>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8 px-2 text-xs'
                      disabled={tagPage <= 1}
                      onClick={() => setTagPage(p => Math.max(1, p - 1))}
                    >
                      Prev
                    </Button>
                    <span className='text-xs text-muted-foreground'>
                      {tagPage} / {totalTagPages}
                    </span>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8 px-2 text-xs'
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

        {featuredPost && !loading && (
          <section className='mb-10'>
            <div className='rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] p-5 shadow-none'>
              <Link
                to={`/blog/${featuredPost.year}/${featuredPost.slug}`}
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
                      to={`/blog/${post.year}/${post.slug}`}
                      className='group grid grid-cols-[112px_minmax(0,1fr)] gap-4 rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] p-4 transition-[border-color,box-shadow,transform] duration-200 ease-spring hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--blog-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99] sm:grid-cols-[140px_minmax(0,1fr)]'
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

        <section className='space-y-5'>
          <div className='flex items-center justify-between gap-4'>
            <h2 className='my-0 text-lg font-semibold text-[hsl(var(--blog-title))]'>
              All posts
            </h2>
            {totalPages > 1 && (
              <p className='text-sm text-muted-foreground'>
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>

          {loading ? (
            <div className='space-y-5'>
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
            <div className='rounded-lg border border-destructive/30 bg-destructive/5 py-12 text-center'>
              <p className='mb-4 text-destructive'>{error}</p>
              <Button
                variant='outline'
                onClick={() => window.location.reload()}
              >
                Try again
              </Button>
            </div>
          ) : pageData.items.length > 0 ? (
            <div className='space-y-3'>
              {(listPosts.length > 0 ? listPosts : pageData.items).map(post => (
                <Link
                  key={`${post.year}/${post.slug}`}
                  to={`/blog/${post.year}/${post.slug}`}
                  className='group grid grid-cols-[84px_minmax(0,1fr)] gap-4 rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] p-3 transition-[border-color,box-shadow,transform] duration-200 ease-spring hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--blog-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99] sm:grid-cols-[120px_minmax(0,1fr)] sm:p-4'
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
          ) : (
            <div className='rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] py-12 text-center'>
              <Search className='mx-auto mb-4 h-14 w-14 text-muted-foreground/40' />
              <p className='mb-2 text-lg font-medium'>No posts found</p>
              <p className='mb-4 text-muted-foreground'>
                {debouncedSearchTerm ||
                selectedCategory !== 'all' ||
                selectedTags.length > 0
                  ? 'Try adjusting your search criteria or filters.'
                  : 'No blog posts are available at the moment.'}
              </p>
              <Button variant='outline' onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}

          {totalPages > 1 && (
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
