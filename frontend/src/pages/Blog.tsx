import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BlogCard, BlogCardSkeleton } from '@/components';
import { Pagination } from '@/components';
import { getPostsPage, getAllCategories, getAllTags } from '@/data/posts';
import { BlogPost, PostsPage } from '@/types/blog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Grid, List } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

const POSTS_PER_PAGE = 12;

const Blog = () => {
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

  // Debounce search term to avoid excessive filtering
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

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

  return (
    <div className='min-h-screen bg-gradient-to-br from-background via-background to-muted/20'>
      {/* Hero/Header Simplified */}
      <div className='border-b bg-background'>
        <div className='container mx-auto px-4 py-12'>
          <div className='text-center max-w-3xl mx-auto'>
            <h1 className='text-4xl md:text-5xl font-bold tracking-tight mb-3'>
              Blog Posts
            </h1>
            <p className='text-muted-foreground'>
              Articles on software development, AI, and technology
            </p>
          </div>
        </div>
      </div>

      <div className='container mx-auto px-4 py-12'>
        {/* Search and Filters (restructured) */}
        <div className='mb-8 space-y-6'>
          {/* Search (primary) */}
          <div className='bg-card/50 backdrop-blur-sm border rounded-xl p-6 shadow-sm'>
            <div className='relative'>
              <Search
                className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground'
                aria-hidden='true'
              />
              <Input
                type='text'
                placeholder='Search posts, tags, or content...'
                aria-label='Search posts'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className='pl-10'
              />
            </div>
          </div>

          {/* Category + Sort (secondary) */}
          <div className='bg-card/50 backdrop-blur-sm border rounded-xl p-4 md:p-6 shadow-sm'>
            <div className='flex flex-col md:flex-row gap-4'>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className='w-full md:w-[240px]'>
                  <SelectValue placeholder='Select category' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className='w-full md:w-[200px]'>
                  <SelectValue placeholder='Sort by' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='date'>Latest First</SelectItem>
                  <SelectItem value='title'>Title (A-Z)</SelectItem>
                  <SelectItem value='readTime'>Read Time</SelectItem>
                </SelectContent>
              </Select>

              <div className='flex gap-2'>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => setViewMode('grid')}
                  className='px-3'
                  aria-pressed={viewMode === 'grid'}
                >
                  <Grid className='h-4 w-4' aria-hidden='true' />
                  <span className='sr-only'>Grid view</span>
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => setViewMode('list')}
                  className='px-3'
                  aria-pressed={viewMode === 'list'}
                >
                  <List className='h-4 w-4' aria-hidden='true' />
                  <span className='sr-only'>List view</span>
                </Button>
              </div>

              {(selectedTags.length > 0 ||
                debouncedSearchTerm ||
                selectedCategory !== 'all') && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={clearFilters}
                  className='ml-auto'
                >
                  <X className='h-4 w-4 mr-1' />
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {/* Tags (collapsible) */}
          <div className='bg-card/50 backdrop-blur-sm border rounded-xl p-4 md:p-6 shadow-sm'>
            <div className='flex flex-wrap gap-2 items-center' id='tag-list'>
              <span className='text-sm font-medium mr-2'>Tags:</span>
              {(showAllTags ? allTags : allTags.slice(0, 10)).map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'secondary'}
                  className='cursor-pointer rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-primary/10'
                  role='button'
                  aria-pressed={selectedTags.includes(tag)}
                  aria-label={`Toggle tag ${tag}`}
                  tabIndex={0}
                  onClick={() => handleTagToggle(tag)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTagToggle(tag);
                    }
                  }}
                >
                  #{tag}
                </Badge>
              ))}
              {allTags.length > 10 && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setShowAllTags(v => !v)}
                  aria-expanded={showAllTags}
                  aria-controls='tag-list'
                >
                  {showAllTags ? 'Less' : `More +${allTags.length - 10}`}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Results count and pagination info */}
        <div className='mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
          <div className='flex items-center gap-4'>
            <p className='text-sm text-muted-foreground'>
              Showing {pageData.items.length} of {pageData.total} posts
            </p>
            {totalPages > 1 && (
              <p className='text-sm text-muted-foreground'>
                Page {currentPage} of {totalPages}
              </p>
            )}
          </div>
          {loading && (
            <div className='text-sm text-muted-foreground animate-pulse'>
              Loading posts...
            </div>
          )}
        </div>

        {/* Blog Posts Grid/List */}
        {loading ? (
          <div
            className={`grid gap-8 ${viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}
          >
            {Array.from({ length: pageData.pageSize || POSTS_PER_PAGE }).map(
              (_, index) => (
                <BlogCardSkeleton key={index} />
              )
            )}
          </div>
        ) : error ? (
          <div className='text-center py-12'>
            <p className='text-red-500 mb-4'>{error}</p>
            <Button variant='outline' onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        ) : pageData.items.length > 0 ? (
          <>
            <div
              className={`grid gap-8 ${viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}
            >
              {pageData.items.map(post => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className='mt-12'>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  className='justify-center'
                />
              </div>
            )}
          </>
        ) : (
          <div className='text-center py-12'>
            <div className='mb-4'>
              <Search className='h-16 w-16 mx-auto text-muted-foreground/50 mb-4' />
              <p className='text-lg font-medium mb-2'>No posts found</p>
              <p className='text-muted-foreground mb-4'>
                {debouncedSearchTerm ||
                selectedCategory !== 'all' ||
                selectedTags.length > 0
                  ? 'Try adjusting your search criteria or filters.'
                  : 'No blog posts are available at the moment.'}
              </p>
            </div>
            {(debouncedSearchTerm ||
              selectedCategory !== 'all' ||
              selectedTags.length > 0) && (
              <Button variant='outline' onClick={clearFilters}>
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;
