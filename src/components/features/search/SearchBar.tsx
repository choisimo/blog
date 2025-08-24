import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { BlogPost } from '@/types/blog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Search } from 'lucide-react';

interface SearchBarProps {
  posts: BlogPost[];
  onSearchResults: (posts: BlogPost[]) => void;
  placeholder?: string;
}

export const SearchBar = ({
  posts,
  onSearchResults,
  placeholder = '블로그 검색...',
}: SearchBarProps) => {
  const [query, setQuery] = useState('');

  // Fuse.js 설정
  const fuse = useMemo(
    () =>
      new Fuse(posts, {
        keys: [
          { name: 'title', weight: 3 },
          { name: 'description', weight: 2 },
          { name: 'content', weight: 1 },
          { name: 'tags', weight: 2 },
          { name: 'category', weight: 2 },
        ],
        threshold: 0.3,
        includeScore: true,
      }),
    [posts]
  );

  useEffect(() => {
    if (query.trim() === '') {
      onSearchResults(posts);
    } else {
      const results = fuse.search(query);
      onSearchResults(results.map(result => result.item));
    }
  }, [query, posts, onSearchResults, fuse]);

  const handleClear = () => {
    setQuery('');
  };

  return (
    <div className='relative w-full'>
      <div className='relative group'>
        <div className='absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors group-focus-within:text-primary'>
          <Search className='w-4 h-4' />
        </div>
        <Input
          type='text'
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          className='pl-10 pr-10 h-11 bg-background/50 border-border/50 backdrop-blur-sm focus:bg-background focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/60'
        />
        {query && (
          <Button
            variant='ghost'
            size='sm'
            onClick={handleClear}
            className='absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors rounded-full'
          >
            <X className='w-3 h-3' />
          </Button>
        )}

        {/* Search indicator */}
        <div className='absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary to-accent transform scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300 rounded-full' />
      </div>

      {query && (
        <div className='mt-3 p-2 rounded-lg bg-muted/30 border border-border/30'>
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <div className='w-1.5 h-1.5 rounded-full bg-primary animate-pulse'></div>
            <span className='font-medium'>'{query}' 검색 결과</span>
          </div>
        </div>
      )}
    </div>
  );
};
