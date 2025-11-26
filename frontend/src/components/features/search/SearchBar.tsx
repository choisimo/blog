import { useState, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import { BlogPost } from "@/types/blog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Search, Terminal, ChevronRight } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  posts: BlogPost[];
  onSearchResults: (posts: BlogPost[]) => void;
  placeholder?: string;
}

export function SearchBar({
  posts,
  onSearchResults,
  placeholder = "블로그 검색...",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const { isTerminal } = useTheme();

  // Fuse.js 설정
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

  useEffect(() => {
    if (query.trim() === "") {
      onSearchResults(posts);
    } else {
      const results = fuse.search(query);
      onSearchResults(results.map((result) => result.item));
    }
  }, [query, posts, onSearchResults, fuse]);

  const handleClear = () => {
    setQuery("");
  };

  // Terminal style search bar
  if (isTerminal) {
    return (
      <div className="relative w-full font-mono">
        <div className="relative group">
          <div className="flex items-center border border-border bg-[hsl(var(--terminal-code-bg))]">
            {/* Terminal prompt prefix */}
            <div className="flex items-center gap-1.5 px-3 py-2.5 border-r border-border/50 text-primary select-none shrink-0">
              <Terminal className="w-4 h-4" />
              <span className="text-sm font-bold">grep</span>
            </div>

            {/* Input field */}
            <div className="flex-1 flex items-center">
              <Input
                type="text"
                placeholder='--pattern "search query"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 h-10 border-0 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            {/* Actions */}
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

          {/* Terminal-style cursor blink indicator when focused */}
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
      </div>
    );
  }

  // Default style search bar
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

        {/* Search indicator */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary to-accent transform scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300 rounded-full" />
      </div>

      {query && (
        <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span className="font-medium">'{query}' 검색 결과</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchBar;
