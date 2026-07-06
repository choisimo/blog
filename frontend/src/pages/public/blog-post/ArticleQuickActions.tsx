import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";
import { TocDrawer } from "@/components/features/blog";
import { cn, throttle } from "@/lib/utils";

type ArticleQuickActionsProps = {
  postId: string;
  isTerminal: boolean;
  tocContent: string;
  tocPostTitle?: string;
};

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const HAS_CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]/;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeQuickActionText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .replace(CONTROL_TEXT_PATTERN, " ")
    .replace(COLLAPSED_WHITESPACE_PATTERN, " ")
    .trim();
  return normalized || undefined;
}

function normalizeQuickActionPostId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    !normalized ||
    HAS_CONTROL_TEXT_PATTERN.test(normalized) ||
    normalized.includes("\\") ||
    normalized.includes("//")
  ) {
    return null;
  }
  return normalized;
}

export function ArticleQuickActions({
  postId,
  isTerminal,
  tocContent,
  tocPostTitle,
}: ArticleQuickActionsProps) {
  const [showTop, setShowTop] = useState(false);
  const safePostId = normalizeQuickActionPostId(postId);
  const safeTocPostTitle = normalizeQuickActionText(tocPostTitle);

  const updateVisibility = useCallback(() => {
    setShowTop(window.scrollY > 300);
  }, []);

  const throttledUpdate = useMemo(
    () => throttle(updateVisibility, 120),
    [updateVisibility],
  );

  useEffect(() => {
    updateVisibility();
    window.addEventListener("scroll", throttledUpdate, { passive: true });
    return () => window.removeEventListener("scroll", throttledUpdate);
  }, [throttledUpdate, updateVisibility]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (!safePostId) return null;

  return (
    <div
      className={cn(
        "fixed z-[var(--z-fab-bar)] flex flex-col gap-1 rounded-2xl border p-1 shadow-sm backdrop-blur-md print:hidden",
        "transition-opacity duration-200 pointer-events-none",
        showTop ? "opacity-90" : "opacity-75",
        isTerminal
          ? "border-[hsl(var(--terminal-inactive-border))] bg-background/75"
          : "border-border/60 bg-background/70",
      )}
      style={{
        right: "max(10px, env(safe-area-inset-right, 0px))",
        bottom: "calc(104px + env(safe-area-inset-bottom, 0px))",
      }}
      aria-label="Article quick actions"
    >
      {!isTerminal && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="맨 위로 이동"
          className={cn(
            "relative grid h-9 w-9 place-items-center rounded-xl pointer-events-auto",
            "text-muted-foreground transition-all duration-200 after:absolute after:-inset-1 after:rounded-[14px]",
            showTop ? "scale-100 opacity-100" : "scale-90 opacity-35",
            "hover:bg-muted hover:text-foreground",
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}

      <TocDrawer
        content={tocContent}
        postTitle={safeTocPostTitle}
        triggerPlacement="inline"
        triggerClassName="pointer-events-auto"
      />
    </div>
  );
}
