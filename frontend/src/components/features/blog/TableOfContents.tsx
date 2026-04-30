import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { BookOpen, Menu, X } from "lucide-react";
import { buildMarkdownToc } from "@/utils/content/markdownHeadings";

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  onClose?: () => void;
  postTitle?: string;
  sticky?: boolean;
}

export const TableOfContents = ({
  content,
  onClose,
  postTitle,
  sticky = true,
}: TableOfContentsProps) => {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const { isTerminal } = useTheme();
  const isMobile = useIsMobile();

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const STICKY_TOP_PX = 96;

  useEffect(() => {
    const headings = buildMarkdownToc(content, postTitle) as TocItem[];
    setToc(headings);
    setActiveId(headings[0]?.id ?? "");
    itemRefs.current = {};
  }, [content, postTitle]);

  useEffect(() => {
    if (isMobile) return;

    let mutationObserver: MutationObserver | null = null;

    const visibleHeadings = new Map<string, number>();
    const observedHeadingIds = new Set<string>();
    const headingObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const heading = entry.target as HTMLElement;
          if (!heading.id) return;

          if (entry.isIntersecting) {
            visibleHeadings.set(heading.id, entry.boundingClientRect.top);
          } else {
            visibleHeadings.delete(heading.id);
          }
        });

        if (visibleHeadings.size > 0) {
          const topmostHeadingId = [...visibleHeadings.entries()].sort(
            (a, b) => a[1] - b[1],
          )[0][0];
          setActiveId(topmostHeadingId);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    const boundaryEl = document.querySelector("[data-toc-boundary]");
    const observeHeadings = () => {
      boundaryEl?.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((heading) => {
        if (!heading.id || observedHeadingIds.has(heading.id)) return;
        observedHeadingIds.add(heading.id);
        headingObserver.observe(heading);
      });
    };

    observeHeadings();

    if (boundaryEl && typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(observeHeadings);
      mutationObserver.observe(boundaryEl, { childList: true, subtree: true });
    }

    return () => {
      mutationObserver?.disconnect();
      headingObserver.disconnect();
    };
  }, [content, isMobile, postTitle]);

  useEffect(() => {
    if (isMobile || !activeId) return;

    const tocRoot = scrollAreaRef.current;
    const activeItem = itemRefs.current[activeId];
    if (!tocRoot || !activeItem) return;

    const viewport = tocRoot.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;

    const viewportRect = viewport.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const itemOffset = itemRect.top - viewportRect.top + viewport.scrollTop;
    const viewportHeight = viewportRect.height;
    const upperThreshold = viewport.scrollTop + viewportHeight * 0.2;
    const lowerThreshold = viewport.scrollTop + viewportHeight * 0.8;

    if (itemOffset < upperThreshold || itemOffset > lowerThreshold) {
      const target = itemOffset - viewportHeight * 0.35;
      viewport.scrollTo({
        top: Math.max(0, target),
        behavior: "smooth",
      });
    }
  }, [activeId, isMobile]);

  const scrollToHeading = (id: string, closePanel?: () => void) => {
    const element = document.getElementById(id);
    if (element) {
      const targetY =
        element.getBoundingClientRect().top +
        window.scrollY -
        (STICKY_TOP_PX + 12);
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: "smooth",
      });
      closePanel?.();
      onClose?.();
    }
  };

  if (toc.length === 0) return null;

  return (
    <div
      data-testid="toc-panel"
      className={cn("w-full", sticky && "sticky top-24")}
    >
      <div
        className={cn(
          "flex flex-col rounded-[24px] border border-zinc-200/70 bg-white/90 px-6 py-7 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-[hsl(var(--card-blog)/0.9)]",
          sticky && "min-h-[calc(100vh-8rem)] max-h-[calc(100vh-7rem)]",
          isTerminal &&
            "bg-[hsl(var(--terminal-code-bg))] border-border rounded-lg",
        )}
      >
        {/* Terminal-style header */}
        {isTerminal && (
          <div className="flex items-center gap-1.5 mb-4 pb-3 border-b border-border">
            <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
          </div>
        )}

        <h3
          className={cn(
            "mb-6 flex items-center gap-3 px-2 text-base font-bold text-foreground",
            isTerminal && "font-mono text-primary text-sm",
          )}
        >
          {isTerminal ? (
            <>
              <span className="text-muted-foreground mr-2">$</span>
              cat TOC
            </>
          ) : (
            <>
              <Menu className="h-5 w-5" aria-hidden="true" />
              목차
            </>
          )}
        </h3>
        <ScrollArea
          ref={scrollAreaRef}
          className={cn(
            "min-h-0",
            sticky ? "h-[calc(100vh-15rem)]" : "max-h-[calc(100vh-12rem)]",
          )}
        >
          <nav className="space-y-3 pr-2" aria-label="글 목차">
            {toc.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                ref={(node) => {
                  if (node) {
                    itemRefs.current[item.id] = node;
                  } else {
                    delete itemRefs.current[item.id];
                  }
                }}
                title={item.title}
                onClick={() => scrollToHeading(item.id)}
                aria-current={activeId === item.id ? "location" : undefined}
                className={cn(
                  "block w-full rounded-lg border-l-2 border-transparent py-3 pr-3 text-left text-sm transition-colors duration-200",
                  "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
                  activeId === item.id &&
                    "border-primary bg-primary/15 font-semibold text-primary",
                  item.level <= 2 && "pl-4",
                  item.level === 3 && "pl-7",
                  item.level === 4 && "pl-10",
                  item.level === 5 && "pl-12",
                  item.level === 6 && "pl-14",
                  isTerminal && "font-mono text-xs rounded hover:bg-primary/20",
                  isTerminal &&
                    activeId === item.id &&
                    "bg-primary/20 border-l-2 border-primary",
                )}
              >
                <span className="block break-words leading-snug">
                  {isTerminal && (
                    <span className="text-muted-foreground mr-2">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  )}
                  {item.title}
                </span>
              </button>
            ))}
          </nav>
        </ScrollArea>
      </div>
    </div>
  );
};

// Mobile TOC Drawer — floating button that opens a Sheet
export const TocDrawer = ({
  content,
  postTitle,
  showAfterScroll = false,
  triggerClassName,
  triggerPlacement = "floating",
  scrollThreshold = 300,
}: {
  content: string;
  postTitle?: string;
  showAfterScroll?: boolean;
  triggerClassName?: string;
  triggerPlacement?: "floating" | "inline";
  scrollThreshold?: number;
}) => {
  const [open, setOpen] = useState(false);
  const [isTriggerVisible, setIsTriggerVisible] = useState(!showAfterScroll);
  const { isTerminal } = useTheme();
  const triggerVisibleRef = useRef(!showAfterScroll);

  useEffect(() => {
    if (!showAfterScroll) {
      triggerVisibleRef.current = true;
      setIsTriggerVisible(true);
      return;
    }

    let rafId: number | null = null;

    const updateVisibility = () => {
      const nextVisible = window.scrollY > scrollThreshold;
      if (nextVisible !== triggerVisibleRef.current) {
        triggerVisibleRef.current = nextVisible;
        setIsTriggerVisible(nextVisible);
      }
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateVisibility();
      });
    };

    updateVisibility();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [scrollThreshold, showAfterScroll]);

  const hasToc = buildMarkdownToc(content, postTitle).length > 0;
  if (!hasToc) return null;

  const isFloatingTrigger = triggerPlacement === "floating";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          data-testid="toc-mobile-trigger"
          aria-label="목차 열기"
          aria-hidden={!isTriggerVisible}
          tabIndex={isTriggerVisible ? undefined : -1}
          className={cn(
            "transition-[opacity,transform,background-color,color,box-shadow] duration-200 ease-out",
            isTriggerVisible
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-2 scale-95 opacity-0",
            isFloatingTrigger
              ? [
                  "fixed z-[var(--z-fab-bar)] print:hidden",
                  "flex h-12 w-12 items-center justify-center rounded-full shadow-lg",
                  "right-4 bottom-[calc(224px+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(156px+env(safe-area-inset-bottom,0px))] md:right-6 md:bottom-44 lg:right-8 lg:bottom-[calc(172px+env(safe-area-inset-bottom,0px))]",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
                  isTerminal &&
                    "rounded-lg border border-primary/40 bg-[hsl(var(--terminal-code-bg))] text-primary",
                ]
              : [
                  "relative grid h-9 w-9 place-items-center rounded-xl",
                  "text-muted-foreground after:absolute after:-inset-1 after:rounded-[14px]",
                  "hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  isTerminal &&
                    "hover:bg-[hsl(var(--terminal-glow)/0.12)] hover:text-[hsl(var(--terminal-glow))]",
                ],
            triggerClassName,
          )}
        >
          <BookOpen className={cn(isFloatingTrigger ? "h-5 w-5" : "h-4 w-4")} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className={cn(
          "w-80 p-0 overflow-y-auto",
          isTerminal && "bg-[hsl(var(--terminal-code-bg))] border-primary/20",
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <SheetTitle
            className={cn(
              "font-bold text-base",
              isTerminal && "font-mono text-primary",
            )}
          >
            {isTerminal ? "$ cat TOC" : "목차"}
          </SheetTitle>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <TableOfContents
            content={content}
            postTitle={postTitle}
            onClose={() => setOpen(false)}
            sticky={false}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TableOfContents;
