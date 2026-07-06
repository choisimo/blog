import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Fuse from "fuse.js";
import {
  ArrowRight,
  BookOpen,
  Clock,
  FileText,
  FolderKanban,
  History,
  Search,
  Terminal,
  Trash2,
  User,
  X,
} from "lucide-react";
import { usePostsIndex } from "@/hooks/content/usePostsIndex";
import { useTheme } from "@/contexts/ThemeContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BlogPost } from "@/types/blog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MiniTerminal } from "@/components/molecules/MiniTerminal";
import {
  getRecentQueries,
  addSearchQuery,
  removeSearchQuery,
} from "@/services/session/searchHistory";

interface HeaderSearchBarProps {
  className?: string;
  presentation?: "auto" | "inline";
  label?: string;
  title?: string;
  inputLabel?: string;
  placeholder?: string;
  terminalPlaceholder?: string;
  clearLabel?: string;
  openSearchLabel?: string;
  searchPostsLabel?: string;
  openTerminalLabel?: string;
  removeHistoryLabel?: string;
  recentSearchLabel?: string;
  recentSearchesLabel?: string;
  quickJumpLabel?: string;
  resultLabel?: string;
  noResultsLabel?: string;
}

const HOME_SCROLL_THRESHOLD_PX = 220;
const QUICK_LINKS = [
  { label: "Blog", href: "/blog", icon: BookOpen },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "About", href: "/about", icon: User },
] as const;

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;
const CONTROL_CHAR_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_SEARCH_LABEL = "Header search";
const DEFAULT_INPUT_LABEL = "Search posts";
const DEFAULT_PLACEHOLDER = "Search posts... (press /)";
const DEFAULT_TERMINAL_PLACEHOLDER = "/ to search";
const DEFAULT_CLEAR_LABEL = "Clear search";
const DEFAULT_OPEN_SEARCH_LABEL = "Open search";
const DEFAULT_SEARCH_POSTS_LABEL = "Search posts";
const DEFAULT_OPEN_TERMINAL_LABEL = "Open terminal";
const DEFAULT_REMOVE_HISTORY_LABEL = "Remove from history";
const DEFAULT_RECENT_SEARCH_LABEL = "Recent search";
const DEFAULT_RECENT_SEARCHES_LABEL = "Recent Searches";
const DEFAULT_QUICK_JUMP_LABEL = "Quick Jump";
const DEFAULT_RESULT_LABEL = "Open result";
const DEFAULT_NO_RESULTS_LABEL = "No results for";

function decodeSearchPathValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function normalizeSearchText(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return String(value)
    .replace(ANSI_ESCAPE_PATTERN, " ")
    .replace(CONTROL_CHAR_PATTERN, " ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

function normalizeSearchLabel(value: unknown, fallback: string): string {
  return normalizeSearchText(value) || fallback;
}

function normalizeOptionalSearchText(value: unknown): string | undefined {
  return normalizeSearchText(value) || undefined;
}

function normalizeRecentQueries(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const normalized = values
    .map((value) => normalizeSearchText(value))
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function normalizePathSegment(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const raw = String(value).trim();
  const decoded = decodeSearchPathValue(raw);
  if (
    !raw ||
    !decoded ||
    raw.includes("/") ||
    raw.includes("\\") ||
    decoded.includes("/") ||
    decoded.includes("\\") ||
    CONTROL_CHAR_TEST_PATTERN.test(raw) ||
    CONTROL_CHAR_TEST_PATTERN.test(decoded)
  ) {
    return undefined;
  }

  const normalized = normalizeSearchText(raw);
  return normalized ? encodeURIComponent(normalized) : undefined;
}

function buildPostPath(post: BlogPost): string {
  const year = normalizePathSegment(post.year);
  const slug = normalizePathSegment(post.slug);
  return year && slug ? `/blog/${year}/${slug}` : "/blog";
}

function isComposingEvent(e: ReactKeyboardEvent<HTMLInputElement>): boolean {
  const nativeEvent = e.nativeEvent as { isComposing?: boolean };
  const syntheticEvent = e as unknown as { isComposing?: boolean };
  return nativeEvent.isComposing === true || syntheticEvent.isComposing === true;
}

export function HeaderSearchBar({
  className,
  presentation = "auto",
  label = DEFAULT_SEARCH_LABEL,
  title,
  inputLabel = DEFAULT_INPUT_LABEL,
  placeholder = DEFAULT_PLACEHOLDER,
  terminalPlaceholder = DEFAULT_TERMINAL_PLACEHOLDER,
  clearLabel = DEFAULT_CLEAR_LABEL,
  openSearchLabel = DEFAULT_OPEN_SEARCH_LABEL,
  searchPostsLabel = DEFAULT_SEARCH_POSTS_LABEL,
  openTerminalLabel = DEFAULT_OPEN_TERMINAL_LABEL,
  removeHistoryLabel = DEFAULT_REMOVE_HISTORY_LABEL,
  recentSearchLabel = DEFAULT_RECENT_SEARCH_LABEL,
  recentSearchesLabel = DEFAULT_RECENT_SEARCHES_LABEL,
  quickJumpLabel = DEFAULT_QUICK_JUMP_LABEL,
  resultLabel = DEFAULT_RESULT_LABEL,
  noResultsLabel = DEFAULT_NO_RESULTS_LABEL,
}: HeaderSearchBarProps) {
  const [searchActive, setSearchActive] = useState(false);
  const { posts } = usePostsIndex(searchActive);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [homeScrolled, setHomeScrolled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalPrefixRef = useRef<HTMLDivElement>(null);
  const [terminalPrefixWidth, setTerminalPrefixWidth] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { isTerminal } = useTheme();

  const isHome = location.pathname === "/";
  const usePopoverSearch = presentation !== "inline";
  const terminalPath =
    location.pathname === "/" ? "~" : `~${location.pathname}`;
  const queryTrimmed = normalizeSearchText(query);
  const safeLabel = normalizeSearchLabel(label, DEFAULT_SEARCH_LABEL);
  const safeTitle = normalizeOptionalSearchText(title);
  const safeInputLabel = normalizeSearchLabel(inputLabel, DEFAULT_INPUT_LABEL);
  const safePlaceholder = normalizeSearchLabel(placeholder, DEFAULT_PLACEHOLDER);
  const safeTerminalPlaceholder = normalizeSearchLabel(
    terminalPlaceholder,
    DEFAULT_TERMINAL_PLACEHOLDER,
  );
  const safeClearLabel = normalizeSearchLabel(clearLabel, DEFAULT_CLEAR_LABEL);
  const safeOpenSearchLabel = normalizeSearchLabel(
    openSearchLabel,
    DEFAULT_OPEN_SEARCH_LABEL,
  );
  const safeSearchPostsLabel = normalizeSearchLabel(
    searchPostsLabel,
    DEFAULT_SEARCH_POSTS_LABEL,
  );
  const safeOpenTerminalLabel = normalizeSearchLabel(
    openTerminalLabel,
    DEFAULT_OPEN_TERMINAL_LABEL,
  );
  const safeRemoveHistoryLabel = normalizeSearchLabel(
    removeHistoryLabel,
    DEFAULT_REMOVE_HISTORY_LABEL,
  );
  const safeRecentSearchLabel = normalizeSearchLabel(
    recentSearchLabel,
    DEFAULT_RECENT_SEARCH_LABEL,
  );
  const safeRecentSearchesLabel = normalizeSearchLabel(
    recentSearchesLabel,
    DEFAULT_RECENT_SEARCHES_LABEL,
  );
  const safeQuickJumpLabel = normalizeSearchLabel(
    quickJumpLabel,
    DEFAULT_QUICK_JUMP_LABEL,
  );
  const safeResultLabel = normalizeSearchLabel(resultLabel, DEFAULT_RESULT_LABEL);
  const safeNoResultsLabel = normalizeSearchLabel(
    noResultsLabel,
    DEFAULT_NO_RESULTS_LABEL,
  );
  const safeTerminalPath = normalizeSearchText(terminalPath) || "~";

  const fuse = useMemo(
    () =>
      new Fuse(posts, {
        keys: [
          { name: "title", weight: 3 },
          { name: "description", weight: 2 },
          { name: "tags", weight: 2 },
          { name: "category", weight: 1.5 },
        ],
        threshold: 0.35,
        includeScore: true,
      }),
    [posts],
  );

  const results = useMemo(() => {
    if (!queryTrimmed) return [];
    return fuse
      .search(queryTrimmed)
      .slice(0, 5)
      .map((result) => result.item);
  }, [fuse, queryTrimmed]);

  useEffect(() => {
    setRecentQueries(normalizeRecentQueries(getRecentQueries()));

    const handleUpdate = () =>
      setRecentQueries(normalizeRecentQueries(getRecentQueries()));
    window.addEventListener("searchHistory:update", handleUpdate);
    return () =>
      window.removeEventListener("searchHistory:update", handleUpdate);
  }, []);

  useEffect(() => {
    if (!usePopoverSearch || !isHome) {
      setHomeScrolled(false);
      return;
    }

    const updateScrollState = () => {
      setHomeScrolled(window.scrollY > HOME_SCROLL_THRESHOLD_PX);
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, [isHome, usePopoverSearch]);

  const handleSelect = useCallback(
    (post: BlogPost) => {
      if (queryTrimmed) {
        addSearchQuery(queryTrimmed);
      }

      navigate(buildPostPath(post));
      setQuery("");
      setIsOpen(false);
      setPanelOpen(false);
      setShowHistory(false);
      setSelectedIndex(0);
    },
    [navigate, queryTrimmed],
  );

  const focusSearchInput = useCallback(() => {
    setSearchActive(true);
    if (usePopoverSearch) {
      setPanelOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    inputRef.current?.focus();
  }, [usePopoverSearch]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        setShowHistory(false);
        if (usePopoverSearch) {
          setPanelOpen(false);
        }
        setQuery("");
        inputRef.current?.blur();
        return;
      }

      if (isComposingEvent(e)) return;

      if (results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((index) => (index + 1) % results.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(
            (index) => (index - 1 + results.length) % results.length,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
      }
    },
    [handleSelect, results, selectedIndex, usePopoverSearch],
  );

  const handleRecentSelect = useCallback((recentQuery: string) => {
    const safeQuery = normalizeSearchText(recentQuery);
    if (!safeQuery) return;

    setQuery(safeQuery);
    setShowHistory(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleRemoveRecent = useCallback(
    (recentQuery: string, e: ReactMouseEvent) => {
      e.stopPropagation();
      const safeQuery = normalizeSearchText(recentQuery);
      if (safeQuery) {
        removeSearchQuery(safeQuery);
      }
    },
    [],
  );

  const handleFocus = useCallback(() => {
    setSearchActive(true);

    if (queryTrimmed) {
      setIsOpen(true);
      return;
    }

    if (recentQueries.length > 0) {
      setShowHistory(true);
    }
  }, [queryTrimmed, recentQueries.length]);

  const handleClear = useCallback(() => {
    setQuery("");
    setIsOpen(false);
    setShowHistory(recentQueries.length > 0 && !usePopoverSearch);
  }, [recentQueries.length, usePopoverSearch]);

  const handleQuickNavigate = useCallback(
    (href: string) => {
      setPanelOpen(false);
      setShowHistory(false);
      setIsOpen(false);
      navigate(href);
    },
    [navigate],
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isEditable =
        target?.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT";

      if (isEditable) return;

      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        focusSearchInput();
        return;
      }

      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        focusSearchInput();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [focusSearchInput]);

  useEffect(() => {
    if (usePopoverSearch) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setShowHistory(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [usePopoverSearch]);

  useEffect(() => {
    if (!isTerminal) return;

    const prefix = terminalPrefixRef.current;
    if (!prefix) return;

    const updatePrefixWidth = () => {
      setTerminalPrefixWidth(prefix.getBoundingClientRect().width);
    };

    updatePrefixWidth();
    const observer = new ResizeObserver(() => updatePrefixWidth());
    observer.observe(prefix);
    return () => observer.disconnect();
  }, [isTerminal, terminalPath]);

  useEffect(() => {
    setIsOpen(queryTrimmed.length > 0);
    setSelectedIndex(0);
    if (queryTrimmed) {
      setShowHistory(false);
    }
  }, [queryTrimmed]);

  useEffect(() => {
    if (!panelOpen) return;
    setSearchActive(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [panelOpen]);

  const renderTerminalInput = (floating = false) => (
    <div className={cn("relative group font-mono", floating && "rounded-xl")}>
      <div
        className={cn(
          "flex items-center border border-border bg-[hsl(var(--terminal-code-bg))]",
          floating && "overflow-hidden rounded-xl",
        )}
      >
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-border/50 px-3 py-2 text-primary transition-colors hover:bg-primary/10"
              aria-label={safeOpenTerminalLabel}
              type="button"
            >
              <Terminal aria-hidden="true" className="h-4 w-4" />
              <span className="text-xs font-bold">grep</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="start">
            <MiniTerminal />
          </PopoverContent>
        </Popover>
        <div className="relative flex-1">
          <div
            ref={terminalPrefixRef}
            className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs text-muted-foreground"
          >
            <span className="flex-shrink-0 text-primary">user@blog:</span>
            <span className="max-w-[180px] truncate" title={safeTerminalPath}>
              {safeTerminalPath}
            </span>
            <span className="terminal-cursor flex-shrink-0" />
          </div>
          <Input
            ref={inputRef}
            type="text"
            aria-label={safeInputLabel}
            placeholder={safeTerminalPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onMouseEnter={() => setSearchActive(true)}
            className="h-9 border-0 bg-transparent pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{
              paddingLeft: terminalPrefixWidth
                ? terminalPrefixWidth + 24
                : undefined,
            }}
          />
        </div>
        {queryTrimmed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            aria-label={safeClearLabel}
            className="mr-1 h-7 w-7 rounded-none p-0 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {!floating && (
        <div className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-primary/50 transition-transform duration-300 group-focus-within:scale-x-100" />
      )}
    </div>
  );

  const renderDefaultInput = () => (
      <div className="relative group">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-primary">
        <Search aria-hidden="true" className="h-4 w-4" />
      </div>
      <Input
        ref={inputRef}
        type="text"
        aria-label={safeInputLabel}
        placeholder={safePlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onMouseEnter={() => setSearchActive(true)}
        className="h-10 rounded-xl border border-border/60 bg-background pl-10 pr-10 shadow-none transition-[colors,box-shadow] duration-200 placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-0 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
      />
      {queryTrimmed && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          aria-label={safeClearLabel}
          className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full p-0 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <X aria-hidden="true" className="h-3 w-3" />
        </Button>
      )}
      <div className="absolute inset-x-0 bottom-0 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-primary to-accent transition-transform duration-300 group-focus-within:scale-x-100" />
    </div>
  );

  const renderResults = (floating = false) => {
    if (!queryTrimmed) return null;

    const wrapperClass = floating
      ? "space-y-1"
      : cn(
          "absolute left-0 right-0 top-full z-[var(--z-popover)] mt-2 max-h-80 overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-card/95 shadow-xl backdrop-blur-sm",
          isTerminal && "mt-1 border-border bg-[hsl(var(--terminal-code-bg))]",
        );

    if (results.length === 0) {
      return (
        <div
          className={cn(
            wrapperClass,
            floating
              ? "rounded-xl border border-dashed border-border/60 px-4 py-5 text-center"
              : "px-4 py-6 text-center",
          )}
        >
          <Search aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {safeNoResultsLabel} "{queryTrimmed}"
          </p>
        </div>
      );
    }

    return (
      <div className={wrapperClass}>
        {results.map((post, idx) => {
          const safePostTitle = normalizeSearchText(post.title) || "Untitled post";
          const safePostCategory = normalizeSearchText(post.category) || "Blog";
          const safeReadingTime = normalizeSearchText(post.readingTime);

          return (
            <button
              key={`${post.year}/${post.slug}`}
              type="button"
              aria-label={`${safeResultLabel}: ${safePostTitle}`}
              onClick={() => handleSelect(post)}
              className={cn(
                "w-full text-left transition-colors",
                floating
                  ? cn(
                      "rounded-xl border px-3 py-3",
                      idx === selectedIndex
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/40 hover:bg-muted/50",
                    )
                  : cn(
                      "border-b border-border/30 px-4 py-3 last:border-0",
                      idx === selectedIndex
                        ? "bg-primary/10"
                        : "hover:bg-muted/50",
                    ),
                isTerminal &&
                  floating &&
                  (idx === selectedIndex
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/40 bg-background/30 hover:bg-primary/5"),
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 shrink-0">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      idx === selectedIndex
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <FileText aria-hidden="true" className="h-4 w-4" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {safePostTitle}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="h-5 px-2 py-0 text-[10px]"
                    >
                      {safePostCategory}
                    </Badge>
                    {safeReadingTime && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock aria-hidden="true" className="h-3 w-3" />
                        {safeReadingTime}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight aria-hidden="true" className="mt-2 h-4 w-4 shrink-0 text-primary" />
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderHistoryList = (floating = false) => {
    if (recentQueries.length === 0 || (floating ? panelOpen : !showHistory)) {
      if (floating && recentQueries.length > 0) {
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <History aria-hidden="true" className="h-3.5 w-3.5" />
              {safeRecentSearchesLabel}
            </div>
            <div className="space-y-1">
              {recentQueries.slice(0, 4).map((recentQuery, idx) => (
                <div
                  key={`recent-floating-${idx}`}
                  className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/70 px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => handleRecentSelect(recentQuery)}
                    aria-label={`${safeRecentSearchLabel}: ${recentQuery}`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                  >
                    <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{recentQuery}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveRecent(recentQuery, e)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`${safeRemoveHistoryLabel}: ${recentQuery}`}
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      }

      return null;
    }

    return (
      <div
        className={cn(
          "absolute left-0 right-0 top-full z-[var(--z-popover)] mt-2 max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-card/95 shadow-xl backdrop-blur-sm",
          isTerminal && "mt-1 border-border bg-[hsl(var(--terminal-code-bg))]",
        )}
      >
        <div className="flex items-center gap-2 border-b border-border/30 px-4 py-2 text-xs text-muted-foreground">
          <History aria-hidden="true" className="h-3.5 w-3.5" />
          {safeRecentSearchesLabel}
        </div>
        {recentQueries.map((recentQuery, idx) => (
          <div
            key={`recent-${idx}`}
            className="flex items-center gap-3 border-b border-border/30 px-4 py-3 last:border-0"
          >
            <button
              type="button"
              onClick={() => handleRecentSelect(recentQuery)}
              aria-label={`${safeRecentSearchLabel}: ${recentQuery}`}
              className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm"
            >
              <Clock aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{recentQuery}</span>
            </button>
            <button
              type="button"
              onClick={(e) => handleRemoveRecent(recentQuery, e)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label={`${safeRemoveHistoryLabel}: ${recentQuery}`}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderQuickLinks = () => (
    <div className="space-y-2">
      <div className="px-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {safeQuickJumpLabel}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.href}
              type="button"
              aria-label={`${safeQuickJumpLabel}: ${link.label}`}
              onClick={() => handleQuickNavigate(link.href)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                isTerminal
                  ? "border-primary/20 bg-background/40 hover:bg-primary/10"
                  : "border-border/50 bg-background/80 hover:bg-muted/50",
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
              <span>{link.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderInlineSearch = () => (
    <div
      ref={containerRef}
      role="search"
      aria-label={safeLabel}
      title={safeTitle}
      className={cn("relative", className)}
    >
      {isTerminal ? renderTerminalInput() : renderDefaultInput()}
      {isOpen && renderResults()}
      {!isOpen && showHistory && renderHistoryList()}
    </div>
  );

  const renderPopoverPanel = () => (
    <Popover
      open={panelOpen}
      onOpenChange={(open) => {
        setPanelOpen(open);
        if (!open) {
          setShowHistory(false);
          setIsOpen(false);
        } else {
          setSearchActive(true);
        }
      }}
    >
      <div
        role="search"
        aria-label={safeLabel}
        title={safeTitle}
        className={cn("flex items-center justify-start", className)}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={homeScrolled ? safeSearchPostsLabel : safeOpenSearchLabel}
            onMouseEnter={() => setSearchActive(true)}
            className={cn(
              "group inline-flex h-10 items-center rounded-full border transition-all duration-300",
              homeScrolled
                ? "w-full max-w-[230px] justify-between px-3"
                : "w-10 justify-center",
              isTerminal
                ? "border-primary/30 bg-[hsl(var(--terminal-code-bg))] text-primary hover:bg-primary/10"
                : "border-border/60 bg-background/90 text-foreground hover:border-primary/40 hover:bg-background",
            )}
          >
            <span className="flex items-center gap-2">
              <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
              {homeScrolled && (
                <span
                  className={cn(
                    "truncate text-sm font-medium",
                    isTerminal && "font-mono",
                  )}
                >
                  {isTerminal ? "grep" : "Search"}
                </span>
              )}
            </span>
            {homeScrolled && (
              <span
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em]",
                  isTerminal
                    ? "border-primary/20 text-primary/80"
                    : "border-border/70 text-muted-foreground",
                )}
              >
                /
              </span>
            )}
          </button>
        </PopoverTrigger>
      </div>

      <PopoverContent
        className={cn(
          "w-[min(92vw,28rem)] p-3",
          isTerminal &&
            "border-primary/30 bg-[hsl(var(--terminal-code-bg))] shadow-[0_0_24px_hsl(var(--terminal-glow)/0.14)]",
        )}
        align="start"
      >
        <div className="space-y-3">
          {isTerminal ? renderTerminalInput(true) : renderDefaultInput()}
          {queryTrimmed ? (
            renderResults(true)
          ) : (
            <>
              {renderHistoryList(true)}
              {renderQuickLinks()}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (usePopoverSearch) {
    return renderPopoverPanel();
  }

  return renderInlineSearch();
}

export default HeaderSearchBar;
