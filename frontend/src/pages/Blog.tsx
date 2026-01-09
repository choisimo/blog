import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { BlogCard, BlogCardSkeleton } from '@/components';
import { Pagination } from '@/components';
import { getPostsPage, getAllCategories, getAllTags } from '@/data/posts';
import { BlogPost, PostsPage } from '@/types/blog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/blog';
import { OptimizedImage } from '@/components/common/OptimizedImage';

const POSTS_PER_PAGE = 12;
const TAGS_PER_PAGE = 20;

const Blog = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [categories, setCategories] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [siteTotalPosts, setSiteTotalPosts] = useState(0);
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
    const paramsPage = paramsPageRaw ? Math.max(1, parseInt(paramsPageRaw, 10)) : 1;

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

  return (
    <div className='min-h-screen bg-gradient-to-b from-[#f7f7fb] via-[#f9fafc] to-background dark:from-[#050509] dark:via-[#0d1016] dark:to-[#0d1016]'>
      <div className='mx-auto w-full max-w-5xl px-4 pb-28 pt-8 sm:pt-12'>
        <header className='mb-8 space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm uppercase tracking-[0.2em] text-muted-foreground'>
                Discover
              </p>
              <h1 className='text-3xl font-semibold tracking-tight text-foreground dark:text-white'>Blog Posts</h1>
            </div>
          </div>
          <div className='relative'>
            <Search className='absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              type='text'
              placeholder='Search posts, tags, or content...'
              aria-label='Search posts'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='h-12 rounded-2xl border border-transparent bg-white pl-12 text-base shadow-sm focus-visible:ring-2 focus-visible:ring-primary dark:border-white/10 dark:bg-[#191f29] dark:text-white dark:placeholder:text-white/60'
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
                  className={[
                    'rounded-full px-4 py-1 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-white text-muted-foreground shadow-sm dark:border dark:border-white/10 dark:bg-[#191f29] dark:text-white/80',
                  ].join(' ')}
                >
                  {category}
                </button>
              );
            })}
            {allTags.length > 0 && (
              <button
                type='button'
                className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors'
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

          {/* Selected tags display */}
          {selectedTags.length > 0 && (
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs text-muted-foreground'>Filtered by:</span>
              {selectedTags.map(tag => (
                <Badge
                  key={tag}
                  variant='default'
                  className='cursor-pointer rounded-full px-4 py-2 text-sm gap-1 min-h-[36px] flex items-center'
                  onClick={() => handleTagToggle(tag)}
                >
                  #{tag}
                  <X className='h-3 w-3' />
                </Badge>
              ))}
              <button
                type='button'
                className='text-xs text-muted-foreground underline hover:text-foreground min-h-[36px] flex items-center'
                onClick={handleClearTagFilters}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Tags panel with search and pagination */}
          {showAllTags && (
            <div className='rounded-2xl border border-border/40 bg-white p-4 shadow-soft dark:border-white/5 dark:bg-[#191f29] space-y-3'>
              {/* Tag search */}
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground' />
                <Input
                  type='text'
                  placeholder='Search tags...'
                  value={tagSearchTerm}
                  onChange={e => setTagSearchTerm(e.target.value)}
                  className='h-9 pl-9 text-sm rounded-lg'
                />
                {tagSearchTerm && (
                  <button
                    type='button'
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                    onClick={() => setTagSearchTerm('')}
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                )}
              </div>

              {/* Tags grid */}
              {displayedTags.length > 0 ? (
                <div className='flex flex-wrap gap-2'>
                  {displayedTags.map(tag => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                      className='cursor-pointer rounded-full px-4 py-2 text-sm hover:bg-primary/10 min-h-[36px] flex items-center'
                      onClick={() => handleTagToggle(tag)}
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className='text-sm text-muted-foreground text-center py-4'>
                  No tags found matching "{tagSearchTerm}"
                </p>
              )}

              {/* Tag pagination */}
              {totalTagPages > 1 && (
                <div className='flex items-center justify-between pt-2 border-t border-border/40'>
                  <span className='text-xs text-muted-foreground'>
                    {filteredTags.length} tags found
                  </span>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 px-2 text-xs'
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
                      className='h-7 px-2 text-xs'
                      disabled={tagPage >= totalTagPages}
                      onClick={() => setTagPage(p => Math.min(totalTagPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {featuredPost && (
          <section className='mb-10 space-y-5'>
            <div className='rounded-[28px] border border-border/40 bg-white p-5 shadow-soft dark:border-white/5 dark:bg-[#1b202b] dark:text-white'>
              <div className='space-y-4'>
                <div className='overflow-hidden rounded-3xl bg-muted dark:bg-white/5'>
                  {featuredPost.coverImage ? (
                    <OptimizedImage
                      src={featuredPost.coverImage}
                      alt={featuredPost.title}
                      className='h-64 w-full object-cover'
                    />
                  ) : (
                    <div className='flex h-64 items-center justify-center text-muted-foreground'>
                      <span>No cover</span>
                    </div>
                  )}
                </div>
                <div className='flex flex-wrap items-center gap-3 text-sm text-muted-foreground'>
                  <Badge variant='secondary' className='rounded-full px-3 py-1 dark:bg-white/10'>
                    {featuredPost.category}
                  </Badge>
                  <span>{formatDate(featuredPost.date)}</span>
                  {featuredPost.readingTime && <span>{featuredPost.readingTime}</span>}
                </div>
                <Link
                  to={`/blog/${featuredPost.year}/${featuredPost.slug}`}
                  className='block space-y-3'
                  state={{ from: { pathname: location.pathname, search: location.search } }}
                  data-testid='post-link'
                >
                  <h2 className='text-2xl font-semibold leading-tight text-foreground dark:text-white'>
                    {featuredPost.title}
                  </h2>
                  <p className='text-muted-foreground dark:text-white/70'>{featuredPost.excerpt || featuredPost.description}</p>
                </Link>
              </div>
            </div>

            {spotlightPosts.length > 0 && (
              <div className='grid gap-5 md:grid-cols-2'>
                {spotlightPosts.map(post => (
                  <Link
                    key={post.slug}
                    to={`/blog/${post.year}/${post.slug}`}
                    className='flex gap-4 rounded-2xl border border-border/40 bg-white p-4 shadow-soft dark:border-white/5 dark:bg-[#1a1f2a] dark:text-white'
                    state={{ from: { pathname: location.pathname, search: location.search } }}
                    data-testid='post-link'
                  >
                    <div className='h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted dark:bg-white/10'>
                      {post.coverImage ? (
                        <OptimizedImage
                          src={post.coverImage}
                          alt={post.title}
                          className='h-full w-full object-cover'
                        />
                      ) : (
                        <div className='flex h-full w-full items-center justify-center text-xs text-muted-foreground'>
                          No image
                        </div>
                      )}
                    </div>
                    <div className='space-y-2 text-sm'>
                      <div className='inline-flex items-center rounded-full bg-muted/60 px-2 py-1 text-[11px] uppercase tracking-wide dark:bg-white/10'>
                        {post.category}
                      </div>
                      <h3 className='text-base font-semibold leading-snug text-foreground dark:text-white'>
                        {post.title}
                      </h3>
                      <p className='line-clamp-2 text-muted-foreground dark:text-white/70'>{post.excerpt || post.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section className='space-y-5'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-semibold'>All posts</h2>
            {totalPages > 1 && (
              <p className='text-sm text-muted-foreground'>Page {currentPage} of {totalPages}</p>
            )}
          </div>

          {loading ? (
            <div className='grid gap-4'>
              {Array.from({ length: pageData.pageSize || POSTS_PER_PAGE }).map((_, index) => (
                <BlogCardSkeleton key={index} />
              ))}
            </div>
          ) : error ? (
            <div className='text-center py-12'>
              <p className='text-red-500 mb-4'>{error}</p>
              <Button variant='outline' onClick={() => window.location.reload()}>
                Try again
              </Button>
            </div>
          ) : pageData.items.length > 0 ? (
            <div className='space-y-5'>
              {(listPosts.length > 0 ? listPosts : pageData.items).map(post => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.year}/${post.slug}`}
                  className='flex gap-4 rounded-2xl border border-border/40 bg-white p-4 shadow-soft dark:border-white/5 dark:bg-[#181d27] dark:text-white'
                  state={{ from: { pathname: location.pathname, search: location.search } }}
                  data-testid='post-link'
                >
                  <div className='h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted dark:bg-white/10'>
                    {post.coverImage ? (
                      <OptimizedImage
                        src={post.coverImage}
                        alt={post.title}
                        className='h-full w-full object-cover'
                      />
                    ) : (
                      <div className='flex h-full w-full items-center justify-center text-xs text-muted-foreground'>
                        No image
                      </div>
                    )}
                  </div>
                  <div className='flex-1 space-y-1 text-sm'>
                    <div className='flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground dark:text-white/70'>
                      <span>{post.category}</span>
                      <span>•</span>
                      <span>{formatDate(post.date)}</span>
                    </div>
                    <h3 className='text-base font-semibold leading-snug text-foreground dark:text-white'>
                      {post.title}
                    </h3>
                    <p className='line-clamp-2 text-muted-foreground dark:text-white/70'>{post.excerpt || post.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className='text-center py-12'>
              <Search className='mx-auto mb-4 h-14 w-14 text-muted-foreground/40' />
              <p className='text-lg font-medium mb-2'>No posts found</p>
              <p className='text-muted-foreground mb-4'>
                {debouncedSearchTerm || selectedCategory !== 'all' || selectedTags.length > 0
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
}
;

export default Blog;
