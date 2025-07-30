import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { BlogPost } from '@/types/blog';
import Fuse from 'fuse.js';

interface SearchBarProps {
  posts: BlogPost[];
  onSearchResults: (results: BlogPost[]) => void;
  placeholder?: string;
}

export const SearchBar = ({ 
  posts, 
  onSearchResults, 
  placeholder = "블로그 검색..." 
}: SearchBarProps) => {
  const [query, setQuery] = useState('');
  
  // Fuse.js 설정
  const fuse = new Fuse(posts, {
    keys: [
      { name: 'title', weight: 3 },
      { name: 'description', weight: 2 },
      { name: 'content', weight: 1 },
      { name: 'tags', weight: 2 },
      { name: 'category', weight: 2 }
    ],
    threshold: 0.3,
    includeScore: true
  });

  useEffect(() => {
    if (query.trim() === '') {
      onSearchResults(posts);
    } else {
      const results = fuse.search(query);
      onSearchResults(results.map(result => result.item));
    }
  }, [query, posts, onSearchResults]);

  const handleClear = () => {
    setQuery('');
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
      
      {query && (
        <div className="absolute top-full left-0 right-0 mt-1 text-xs text-muted-foreground">
          '{query}' 검색 결과
        </div>
      )}
    </div>
  );
};