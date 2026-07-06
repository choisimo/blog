import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";
import { prefetchPost } from "@/data/content/posts";
import type { ResolvedRelatedPostCard } from "@/types/blog";

interface BlogPostRelatedProps {
  relatedPosts: ResolvedRelatedPostCard[];
  preservedSearch: string;
  preservedFrom?: { pathname: string; search?: string };
  isTerminal: boolean;
  relatedPostsLabel: string;
  relatedPostsDescLabel: string;
}

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const HAS_CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]/;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeRelatedText(value: unknown, fallback = ""): string {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const normalized = String(value)
    .replace(CONTROL_TEXT_PATTERN, " ")
    .replace(COLLAPSED_WHITESPACE_PATTERN, " ")
    .trim();
  return normalized || fallback;
}

function normalizeRelatedPathSegment(value: unknown): string | null {
  const normalized = normalizeRelatedText(value);
  if (!normalized || normalized.includes("/") || normalized.includes("\\")) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(normalized);
    if (
      !decoded.trim() ||
      decoded === "." ||
      decoded === ".." ||
      HAS_CONTROL_TEXT_PATTERN.test(decoded) ||
      decoded.includes("/") ||
      decoded.includes("\\")
    ) {
      return null;
    }
    return encodeURIComponent(decoded.trim());
  } catch {
    return null;
  }
}

function normalizeRelatedPost(
  relatedPost: ResolvedRelatedPostCard,
): ResolvedRelatedPostCard | null {
  const year = normalizeRelatedPathSegment(relatedPost.year);
  const slug = normalizeRelatedPathSegment(relatedPost.slug);
  if (!year || !slug || !/^\d{4}$/.test(year)) return null;
  return {
    ...relatedPost,
    year,
    slug,
    title: normalizeRelatedText(relatedPost.title, "Untitled post"),
    excerpt: normalizeRelatedText(relatedPost.excerpt),
    categoryLabel: normalizeRelatedText(relatedPost.categoryLabel, "Post"),
    readingTimeLabel: normalizeRelatedText(relatedPost.readingTimeLabel),
  };
}

export function BlogPostRelated({
  relatedPosts,
  preservedSearch,
  preservedFrom,
  isTerminal,
  relatedPostsLabel,
  relatedPostsDescLabel,
}: BlogPostRelatedProps) {
  const safeRelatedPosts = relatedPosts.flatMap((relatedPost) => {
    const normalized = normalizeRelatedPost(relatedPost);
    return normalized ? [normalized] : [];
  });
  const safeRelatedPostsLabel = normalizeRelatedText(relatedPostsLabel, "Related posts");
  const safeRelatedPostsDescLabel = normalizeRelatedText(relatedPostsDescLabel);

  if (safeRelatedPosts.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "rounded-full bg-secondary/20 p-2 text-secondary-foreground dark:bg-white/10 dark:text-white",
            isTerminal && "rounded bg-[hsl(var(--terminal-code-bg))]",
          )}
        >
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h2
            className={cn(
              "text-xl font-semibold text-foreground dark:text-white",
              isTerminal && "font-mono text-primary",
            )}
          >
            {isTerminal ? `> ${safeRelatedPostsLabel}` : safeRelatedPostsLabel}
          </h2>
          <p
            className={cn(
              "text-sm text-foreground/80 dark:text-foreground/80",
              isTerminal && "font-mono text-xs",
            )}
          >
            {safeRelatedPostsDescLabel}
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {safeRelatedPosts.map((relatedPost) => (
          <Link
            key={`${relatedPost.year}/${relatedPost.slug}`}
            to={{
              pathname: `/blog/${relatedPost.year}/${relatedPost.slug}`,
              search: preservedSearch || undefined,
            }}
            state={preservedFrom ? { from: preservedFrom } : undefined}
            className={cn(
              "group rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg dark:border-white/10 dark:bg-[hsl(var(--card-blog))]",
              isTerminal &&
                "rounded-lg border-border bg-[hsl(var(--terminal-code-bg))] hover:border-primary",
            )}
            onMouseEnter={() =>
              prefetchPost(relatedPost.year, relatedPost.slug)
            }
            onFocus={() => prefetchPost(relatedPost.year, relatedPost.slug)}
          >
            <Badge
              variant="secondary"
              className={cn(
                "mb-3 rounded-full px-3 py-1 text-xs dark:bg-white/10 dark:text-white",
                isTerminal &&
                  "rounded font-mono text-primary bg-transparent border border-primary/40",
              )}
            >
              {isTerminal
                ? `[${relatedPost.categoryLabel}]`
                : relatedPost.categoryLabel}
            </Badge>
            <h3
              className={cn(
                "text-base font-semibold leading-snug text-foreground dark:text-white group-hover:text-primary",
                isTerminal && "font-mono",
              )}
            >
              {relatedPost.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-foreground/80 dark:text-foreground/80">
              {relatedPost.excerpt}
            </p>
            {relatedPost.readingTimeLabel && (
              <p
                className={cn(
                  "mt-3 text-xs uppercase tracking-wide text-foreground/70 dark:text-foreground/75",
                  isTerminal && "font-mono",
                )}
              >
                {relatedPost.readingTimeLabel}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
