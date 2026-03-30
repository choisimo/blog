import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MarkdownRenderer = lazy(
  () => import("@/components/features/blog/MarkdownRenderer"),
);

interface BlogPostContentProps {
  content: string;
  inlineEnabled: boolean;
  postTitle: string;
  postPath: string;
  isTerminal: boolean;
}

export function BlogPostContent({
  content,
  inlineEnabled,
  postTitle,
  postPath,
  isTerminal,
}: BlogPostContentProps) {
  return (
    <section
      data-toc-boundary
      className={cn(
        "rounded-[32px] border border-white/50 bg-card/70 p-4 shadow-soft backdrop-blur-sm dark:border-white/5 dark:bg-[hsl(var(--card-blog)/0.9)] sm:p-8 -mx-2 sm:mx-0",
        isTerminal &&
          "rounded-lg border-border bg-[hsl(var(--terminal-code-bg))]",
      )}
    >
      <div
        className={cn(
          "prose prose-gray max-w-none dark:prose-invert",
          isTerminal &&
            "prose-headings:font-mono prose-headings:terminal-glow",
        )}
      >
        <Suspense
          fallback={
            <div
              className="space-y-3"
              aria-label="Loading article content"
            >
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
              <Skeleton className="h-4 w-9/12" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          }
        >
          <MarkdownRenderer
            content={content}
            inlineEnabled={inlineEnabled}
            postTitle={postTitle}
            postPath={postPath}
          />
        </Suspense>
      </div>
    </section>
  );
}
