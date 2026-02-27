import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Fuse from 'fuse.js';
import { BlogPost } from '@/types/blog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Terminal, ArrowRight, Clock, FileText, History, Trash2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MiniTerminal } from '@/components/features/terminal';
import {
  getRecentQueries,
  addSearchQuery,
  removeSearchQuery,
} from '@/services/searchHistory';

interface HeaderSearchBarProps {
  posts: BlogPost[];
  className?: string;
}

export function HeaderSearchBar({ posts, className }: HeaderSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalPrefixRef = useRef<HTMLDivElement>(null);
  const [terminalPrefixWidth, setTerminalPrefixWidth] = useState(0);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isTerminal } = useTheme();

  const terminalPath = location.pathname === '/' ? '~' : `~${location.pathname}`;

  const fuse = useMemo(
    () =>
      new Fuse(posts, {
        keys: [
          { name: 'title', weight: 3 },
          { name: 'description', weight: 2 },
          { name: 'tags', weight: 2 },
          { name: 'category', weight: 1.5 },
        ],
        threshold: 0.35,
        includeScore: true,
      }),
    [posts]
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query).slice(0, 5).map(r => r.item);
  }, [query, fuse]);

  // Load recent queries on mount
  useEffect(() => {
    setRecentQueries(getRecentQueries());

    const handleUpdate = () => setRecentQueries(getRecentQueries());
    window.addEventListener('searchHistory:update', handleUpdate);
    return () => window.removeEventListener('searchHistory:update', handleUpdate);
  }, []);

  const handleSelect = useCallback((post: BlogPost) => {
    // Save the search query to history
    if (query.trim()) {
      addSearchQuery(query.trim());
    }
    navigate(`/blog/${post.year}/${post.slug}`);
    setQuery('');
    setIsOpen(false);
    setShowHistory(false);
    setSelectedIndex(0);
  }, [navigate, query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setShowHistory(false);
        setQuery('');
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, results, selectedIndex, handleSelect]);

  const handleRecentSelect = useCallback((recentQuery: string) => {
    setQuery(recentQuery);
    setShowHistory(false);
    inputRef.current?.focus();
  }, []);

  const handleRemoveRecent = useCallback((recentQuery: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSearchQuery(recentQuery);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isTerminal) return;
    const el = terminalPrefixRef.current;
    if (!el) return;

    const update = () => {
      setTerminalPrefixWidth(el.getBoundingClientRect().width);
    };
    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [isTerminal, terminalPath]);

  useEffect(() => {
    setIsOpen(query.trim().length > 0);
    setShowHistory(false);
    setSelectedIndex(0);
  }, [query]);

  const handleFocus = useCallback(() => {
    if (query.trim()) {
      setIsOpen(true);
    } else if (recentQueries.length > 0) {
      setShowHistory(true);
    }
  }, [query, recentQueries.length]);

  if (isTerminal) {
    return (
      <div ref={containerRef} className={cn('relative', className)}>
        <div className="relative group font-mono">
          <div className="flex items-center border border-border bg-[hsl(var(--terminal-code-bg))]">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-3 py-2 border-r border-border/50 text-primary select-none shrink-0 hover:bg-primary/10 transition-colors cursor-pointer"
                  aria-label="Open terminal"
                >
                  <Terminal className="w-4 h-4" />
                  <span className="text-xs font-bold">grep</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className='w-96 p-0' align='start'>
                <MiniTerminal />
              </PopoverContent>
            </Popover>
            <div className="relative flex-1">
              <div
                ref={terminalPrefixRef}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground"
              >
                <span className="text-primary flex-shrink-0">user@blog:</span>
                <span className="max-w-[180px] truncate" title={terminalPath}>{terminalPath}</span>
                <span className="terminal-cursor flex-shrink-0" />
              </div>
              <Input
                ref={inputRef}
                type="text"
                placeholder='/ to search'
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                className="h-9 border-0 bg-transparent pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ paddingLeft: terminalPrefixWidth ? terminalPrefixWidth + 24 : undefined }}
              />
            </div>
            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setQuery(''); setIsOpen(false); }}
                className="h-7 w-7 p-0 mr-1 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-none"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-primary/50 transform scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300" />
        </div>

        {isOpen && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-border bg-[hsl(var(--terminal-code-bg))] shadow-lg z-[var(--z-popover)] max-h-80 overflow-y-auto overscroll-contain">
            <div className="px-3 py-2 border-b border-border/50 text-xs text-muted-foreground">
              <span className="text-primary">$</span> found {results.length} result{results.length !== 1 && 's'}
            </div>
            {results.map((post, idx) => (
              <button
                key={`${post.year}/${post.slug}`}
                onClick={() => handleSelect(post)}
                className={cn(
                  'w-full text-left px-3 py-3 border-b border-border/30 last:border-0 transition-colors',
                  idx === selectedIndex ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10'
                )}
              >
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 mt-0.5 shrink-0 text-primary/70" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{post.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>[{post.category}]</span>
                      {post.readingTime && (
                        <>
                          <span>•</span>
                          <span>{post.readingTime}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {idx === selectedIndex && <ArrowRight className="w-4 h-4 text-primary" />}
                </div>
              </button>
            ))}
          </div>
        )}

        {isOpen && query.trim() && results.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-border bg-[hsl(var(--terminal-code-bg))] shadow-lg z-[var(--z-popover)] px-3 py-4 text-center text-sm text-muted-foreground">
            <span className="text-primary">$</span> grep: no matches found
          </div>
        )}

        {/* Search History for Terminal Theme */}
        {showHistory && !isOpen && recentQueries.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-border bg-[hsl(var(--terminal-code-bg))] shadow-lg z-[var(--z-popover)] max-h-60 overflow-y-auto overscroll-contain">
            <div className="px-3 py-2 border-b border-border/50 text-xs text-muted-foreground flex items-center gap-2">
              <History className="w-3 h-3 text-primary" />
              <span className="text-primary">$</span> history
            </div>
            {recentQueries.map((recentQuery, idx) => (
              <button
                key={`recent-${idx}`}
                onClick={() => handleRecentSelect(recentQuery)}
                className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-primary/10 transition-colors border-b border-border/30 last:border-0"
              >
                <span className="flex items-center gap-2 text-sm truncate">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {recentQuery}
                </span>
                <button
                  onClick={(e) => handleRemoveRecent(recentQuery, e)}
                  className="p-1 hover:bg-destructive/20 hover:text-destructive rounded transition-colors shrink-0"
                  aria-label="Remove from history"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative group">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors group-focus-within:text-primary">
          <Search className="w-4 h-4" />
        </div>
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search posts... (press /)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          className="pl-10 pr-10 h-10 rounded-xl border border-border/60 bg-background shadow-none focus:border-primary/60 focus:ring-0 transition-colors duration-200 placeholder:text-muted-foreground/60"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setQuery(''); setIsOpen(false); }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors rounded-full"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary to-accent transform scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300 rounded-full" />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-xl z-[var(--z-popover)] max-h-80 overflow-y-auto overscroll-contain">
          {results.map((post, idx) => (
            <button
              key={`${post.year}/${post.slug}`}
              onClick={() => handleSelect(post)}
              className={cn(
                'w-full text-left px-4 py-3 border-b border-border/30 last:border-0 transition-colors',
                idx === selectedIndex ? 'bg-primary/10' : 'hover:bg-muted/50'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-1">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    idx === selectedIndex ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{post.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5">
                      {post.category}
                    </Badge>
                    {post.readingTime && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {post.readingTime}
                      </span>
                    )}
                  </div>
                </div>
                {idx === selectedIndex && (
                  <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-2" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-xl z-[var(--z-popover)] px-4 py-6 text-center">
          <Search className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No results for "{query}"</p>
        </div>
      )}

      {/* Search History for Default Theme */}
      {showHistory && !isOpen && recentQueries.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-xl z-[var(--z-popover)] max-h-60 overflow-y-auto overscroll-contain">
          <div className="px-4 py-2 border-b border-border/30 text-xs text-muted-foreground flex items-center gap-2">
            <History className="w-3.5 h-3.5" />
            Recent Searches
          </div>
          {recentQueries.map((recentQuery, idx) => (
            <button
              key={`recent-${idx}`}
              onClick={() => handleRecentSelect(recentQuery)}
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
            >
              <span className="flex items-center gap-3 text-sm truncate">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                {recentQuery}
              </span>
              <button
                onClick={(e) => handleRemoveRecent(recentQuery, e)}
                className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors shrink-0"
                aria-label="Remove from history"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default HeaderSearchBar;
