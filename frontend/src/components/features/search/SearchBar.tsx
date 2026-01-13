import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Fuse from "fuse.js";
import { BlogPost } from "@/types/blog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Search, Terminal, ChevronRight, Globe, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { searchWeb, type WebSearchResult } from "@/services/webSearch";

interface SearchBarProps {
  posts: BlogPost[];
  onSearchResults: (posts: BlogPost[]) => void;
  onWebSearchResults?: (results: WebSearchResult[], answer?: string) => void;
  placeholder?: string;
  enableWebSearch?: boolean;
}

export function SearchBar({
  posts,
  onSearchResults,
  onWebSearchResults,
  placeholder = "블로그 검색...",
  enableWebSearch = true,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isWebSearching, setIsWebSearching] = useState(false);
  const [webSearchError, setWebSearchError] = useState<string | null>(null);
  const [showWebSearchPrompt, setShowWebSearchPrompt] = useState(false);
  const { isTerminal } = useTheme();
  const webSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fuse = useMemo(
    () =>
      new Fuse(posts, {
        keys: [
          { name: "title", weight: 3 },
          { name: "description", weight: 2 },
          { name: "content", weight: 1 },
          { name: "tags", weight: 2 },
          { name: "category", weight: 2 },
        ],
        threshold: 0.3,
        includeScore: true,
      }),
    [posts],
  );

  const triggerWebSearch = useCallback(async (searchQuery: string) => {
    if (!enableWebSearch || !onWebSearchResults) return;
    
    setIsWebSearching(true);
    setWebSearchError(null);
    
    try {
      const result = await searchWeb(searchQuery, { maxResults: 5 });
      onWebSearchResults(result.results, result.answer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Web search failed';
      setWebSearchError(message);
    } finally {
      setIsWebSearching(false);
    }
  }, [enableWebSearch, onWebSearchResults]);

  useEffect(() => {
    if (webSearchTimeoutRef.current) {
      clearTimeout(webSearchTimeoutRef.current);
    }

    if (query.trim() === "") {
      onSearchResults(posts);
      setShowWebSearchPrompt(false);
      return;
    }

    const results = fuse.search(query);
    const matchedPosts = results.map((result) => result.item);
    onSearchResults(matchedPosts);

    if (matchedPosts.length === 0 && enableWebSearch && onWebSearchResults) {
      webSearchTimeoutRef.current = setTimeout(() => {
        setShowWebSearchPrompt(true);
      }, 500);
    } else {
      setShowWebSearchPrompt(false);
    }
  }, [query, posts, onSearchResults, fuse, enableWebSearch, onWebSearchResults]);

  const handleClear = () => {
    setQuery("");
    setShowWebSearchPrompt(false);
    setWebSearchError(null);
  };

  const handleWebSearchClick = () => {
    triggerWebSearch(query);
  };

  if (isTerminal) {
    return (
      <div className="relative w-full font-mono">
        <div className="relative group">
          <div className="flex items-center border border-border bg-[hsl(var(--terminal-code-bg))]">
            <div className="flex items-center gap-1.5 px-3 py-2.5 border-r border-border/50 text-primary select-none shrink-0">
              <Terminal className="w-4 h-4" />
              <span className="text-sm font-bold">grep</span>
            </div>

            <div className="flex-1 flex items-center">
              <Input
                type="text"
                placeholder='--pattern "search query"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 h-10 border-0 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="flex items-center gap-1 px-2">
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-none"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
              <div className="h-7 w-7 flex items-center justify-center text-primary/70">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-primary/50 transform scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300" />
        </div>

        {query && (
          <div className="mt-2 px-3 py-2 border border-border/50 bg-[hsl(var(--terminal-code-bg))] text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-primary/60">$</span>
              <span>
                grep -r "<span className="text-primary">{query}</span>" ./posts
              </span>
            </div>
            <div className="mt-1 text-primary/70"># Searching...</div>
          </div>
        )}

        {showWebSearchPrompt && enableWebSearch && (
          <div className="mt-2 px-3 py-2 border border-primary/30 bg-primary/5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="w-3.5 h-3.5 text-primary" />
                <span>블로그 내 결과 없음. 웹에서 검색할까요?</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleWebSearchClick}
                disabled={isWebSearching}
                className="h-6 px-2 text-xs text-primary hover:bg-primary/20"
              >
                {isWebSearching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  '웹 검색'
                )}
              </Button>
            </div>
            {webSearchError && (
              <div className="mt-1 text-destructive/70"># Error: {webSearchError}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="relative group">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors group-focus-within:text-primary">
          <Search className="w-4 h-4" />
        </div>
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-11 pr-10 h-11 rounded-xl border border-border/60 bg-background shadow-none focus:border-primary/60 focus:ring-0 transition-colors duration-200 placeholder:text-muted-foreground/60"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors rounded-full"
          >
            <X className="w-3 h-3" />
          </Button>
        )}

        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary to-accent transform scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300 rounded-full" />
      </div>

      {query && !showWebSearchPrompt && (
        <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span className="font-medium">'{query}' 검색 결과</span>
          </div>
        </div>
      )}

      {showWebSearchPrompt && enableWebSearch && (
        <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="w-4 h-4 text-primary" />
              <span>블로그 내 결과가 없습니다</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleWebSearchClick}
              disabled={isWebSearching}
              className="h-8 px-3 text-xs border-primary/30 hover:bg-primary/10"
            >
              {isWebSearching ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  검색 중...
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3 mr-1.5" />
                  웹에서 검색
                </>
              )}
            </Button>
          </div>
          {webSearchError && (
            <div className="mt-2 text-xs text-destructive">{webSearchError}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
