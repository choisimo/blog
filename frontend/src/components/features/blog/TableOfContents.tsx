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
  SheetDescription,
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
  label?: string;
  title?: string;
  headingLabel?: string;
  itemLabel?: string;
}

const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const HAS_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const MALFORMED_PERCENT_PATTERN = /%(?![0-9A-Fa-f]{2})/;
const WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_TOC_LABEL = "글 목차";
const DEFAULT_TOC_HEADING = "목차";
const DEFAULT_TOC_ITEM_LABEL = "목차 항목";
const DEFAULT_DRAWER_TRIGGER_LABEL = "목차 열기";
const DEFAULT_DRAWER_CLOSE_LABEL = "닫기";

function normalizeTocText(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";

  return String(value)
    .replace(ANSI_ESCAPE_PATTERN, " ")
    .replace(SINGLE_LINE_CONTROL_PATTERN, " ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

function normalizeOptionalTocText(value: unknown): string | undefined {
  return normalizeTocText(value) || undefined;
}

function normalizeTocId(value: unknown): string {
  const id = normalizeTocText(value);
  if (
    !id ||
    id.includes("/") ||
    id.includes("\\") ||
    id.includes("#") ||
    MALFORMED_PERCENT_PATTERN.test(id)
  ) {
    return "";
  }
  try {
    const decoded = decodeURIComponent(id);
    if (
      !decoded.trim() ||
      decoded === "." ||
      decoded === ".." ||
      HAS_CONTROL_PATTERN.test(decoded) ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      decoded.includes("#")
    ) {
      return "";
    }
    return decoded.trim();
  } catch {
    return "";
  }
}

function normalizeTocLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 2;
  return Math.max(1, Math.min(6, Math.floor(value)));
}

function normalizeTocItems(items: TocItem[]): TocItem[] {
  return items
    .map((item) => ({
      id: normalizeTocId(item.id),
      title: normalizeTocText(item.title),
      level: normalizeTocLevel(item.level),
    }))
    .filter((item) => item.id && item.title);
}

function haveSameTocItems(left: TocItem[], right: TocItem[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.id === right[index]?.id &&
        item.title === right[index]?.title &&
        item.level === right[index]?.level,
    )
  );
}

function getScrollBehavior(): ScrollBehavior {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
}

export const TableOfContents = ({
  content,
  onClose,
  postTitle,
  sticky = true,
  label = DEFAULT_TOC_LABEL,
  title,
  headingLabel = DEFAULT_TOC_HEADING,
  itemLabel = DEFAULT_TOC_ITEM_LABEL,
}: TableOfContentsProps) => {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const { isTerminal } = useTheme();
  const isMobile = useIsMobile();

  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const STICKY_TOP_PX = 96;

  useEffect(() => {
    const headings = normalizeTocItems(
      buildMarkdownToc(content, postTitle) as TocItem[]
    );
    const validIds = new Set(headings.map((heading) => heading.id));

    setToc((previous) =>
      haveSameTocItems(previous, headings) ? previous : headings,
    );
    setActiveId((previous) =>
      previous && validIds.has(previous) ? previous : (headings[0]?.id ?? ''),
    );
    itemRefs.current = Object.fromEntries(
      Object.entries(itemRefs.current).filter(([id]) => validIds.has(id)),
    );
  }, [content, postTitle]);

  useEffect(() => {
    if (isMobile) return;

    let mutationObserver: MutationObserver | null = null;

    const visibleHeadings = new Map<string, number>();
    const observedHeadingElements = new WeakSet<Element>();
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
        if (!heading.id || observedHeadingElements.has(heading)) return;
        observedHeadingElements.add(heading);
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
  }, [isMobile, toc]);

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
        behavior: getScrollBehavior(),
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
        behavior: getScrollBehavior(),
      });
      closePanel?.();
      onClose?.();
    }
  };

  if (toc.length === 0) return null;
  const safeLabel = normalizeTocText(label) || DEFAULT_TOC_LABEL;
  const safeTitle = normalizeOptionalTocText(title);
  const safeHeadingLabel = normalizeTocText(headingLabel) || DEFAULT_TOC_HEADING;
  const safeItemLabel = normalizeTocText(itemLabel) || DEFAULT_TOC_ITEM_LABEL;

  return (
    <div
      data-testid="toc-panel"
      role="region"
      aria-label={safeLabel}
      title={safeTitle}
      className={cn("ui-toc-panel", sticky && "ui-toc-sticky")}
    >
      <div
        className={cn(
          "ui-toc-body",
          sticky && "ui-toc-scroll-boundary",
          isTerminal &&
            "bg-[hsl(var(--terminal-code-bg))] border-border rounded-lg",
        )}
      >
        {/* Terminal-style header */}
        {isTerminal && (
          <div className="flex items-center gap-1.5 mb-4 pb-3 border-b border-border">
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
          </div>
        )}

        <h3 className="ui-toc-heading">
          <Menu aria-hidden="true" />
          <span>{isTerminal ? `$ cat ${safeHeadingLabel}` : safeHeadingLabel}</span>
          <span className="ui-toc-count" aria-label={`${toc.length}개 항목`}>{String(toc.length).padStart(2, '0')}</span>
        </h3>
        <ScrollArea
          ref={scrollAreaRef}
          type="auto"
          viewportProps={{ tabIndex: 0, role: 'region', 'aria-label': `${safeLabel} 스크롤 영역` }}
          className={cn(
            "min-h-0",
            sticky ? "ui-toc-scroll" : "ui-toc-drawer-scroll",
          )}
        >
          <nav className="ui-toc-list" aria-label={safeLabel}>
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
                type="button"
                title={item.title}
                onClick={() => scrollToHeading(item.id)}
                aria-label={`${safeItemLabel} ${index + 1}: ${item.title}`}
                aria-current={activeId === item.id ? "location" : undefined}
                className="ui-toc-item"
                style={{ paddingInlineStart: `${10 + Math.max(0, item.level - 2) * 12}px` }}
              >
                <span className="block break-words leading-snug">
                  {isTerminal && (
                    <span aria-hidden="true" className="text-muted-foreground mr-2">
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

// TOC Drawer — opened from the article quick-actions button.
export const TocDrawer = ({
  content,
  postTitle,
  showAfterScroll = false,
  triggerClassName,
  triggerPlacement = "floating",
  scrollThreshold = 300,
  label = DEFAULT_TOC_LABEL,
  title,
  triggerLabel = DEFAULT_DRAWER_TRIGGER_LABEL,
  closeLabel = DEFAULT_DRAWER_CLOSE_LABEL,
}: {
  content: string;
  postTitle?: string;
  showAfterScroll?: boolean;
  triggerClassName?: string;
  triggerPlacement?: "floating" | "inline";
  scrollThreshold?: number;
  label?: string;
  title?: string;
  triggerLabel?: string;
  closeLabel?: string;
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
  const safeLabel = normalizeTocText(label) || DEFAULT_TOC_LABEL;
  const safeTitle = normalizeOptionalTocText(title);
  const safeTriggerLabel = normalizeTocText(triggerLabel) || DEFAULT_DRAWER_TRIGGER_LABEL;
  const safeCloseLabel = normalizeTocText(closeLabel) || DEFAULT_DRAWER_CLOSE_LABEL;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          data-testid="toc-mobile-trigger"
          aria-label={safeTriggerLabel}
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
                  "flex h-12 w-12 items-center justify-center rounded-full",
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
          <BookOpen aria-hidden="true" className={cn(isFloatingTrigger ? "h-5 w-5" : "h-4 w-4")} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        hideClose
        aria-label={safeLabel}
        title={safeTitle}
        className={["ui-sheet", (cn(
          "ui-toc-drawer",
          isTerminal && "bg-[hsl(var(--terminal-code-bg))] border-primary/20",
        ))].filter(Boolean).join(' ')}
      >
        <div className="ui-toc-drawer__header">
          <SheetTitle
            className={cn(
              "font-bold text-base",
              isTerminal && "font-mono text-primary",
            )}
          >
            {isTerminal ? `$ cat ${safeLabel}` : safeLabel}
          </SheetTitle>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ui-toc-drawer__close"
            aria-label={safeCloseLabel}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <SheetDescription className="sr-only">항목을 선택하면 본문의 해당 위치로 이동합니다.</SheetDescription>
        <div className="ui-toc-drawer__content">
          <TableOfContents
            content={content}
            postTitle={postTitle}
            onClose={() => setOpen(false)}
            sticky={false}
            label={safeLabel}
            title={safeTitle}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TableOfContents;
