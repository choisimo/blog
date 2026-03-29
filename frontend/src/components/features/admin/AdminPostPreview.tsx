import { useMemo } from "react";
import { TableOfContents } from "@/components/features/blog";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { BlogPostContent } from "@/pages/public/blog-post/BlogPostContent";
import { BlogPostHeader } from "@/pages/public/blog-post/BlogPostHeader";
import type { BlogPost, ResolvedPostViewModel } from "@/types/blog";
import {
  calculateReadTime,
  formatReadingTimeLabel,
} from "@/utils/content/blog";
import { normalizeManifestMediaPath } from "@/utils/content/postMedia";

interface AdminPostPreviewProps {
  title: string;
  slug: string;
  year: string;
  category: string;
  tags: string[];
  coverImage?: string;
  content: string;
  published: boolean;
}

function resolveLanguageName(code: string): string {
  if (code === "ko") return "한국어";
  if (code === "en") return "English";
  return code.toUpperCase();
}

export default function AdminPostPreview({
  title,
  slug,
  year,
  category,
  tags,
  coverImage,
  content,
  published,
}: AdminPostPreviewProps) {
  const { isTerminal } = useTheme();
  const safeYear = /^\d{4}$/.test(year)
    ? year
    : new Date().getFullYear().toString();
  const safeSlug = slug || "draft-post";
  const postPath = `${safeYear}/${safeSlug}`;
  const readingTime = useMemo(() => calculateReadTime(content), [content]);
  const readingTimeLabel = useMemo(
    () => formatReadingTimeLabel(readingTime, "ko"),
    [readingTime],
  );
  const normalizedCoverImage = useMemo(
    () => normalizeManifestMediaPath(coverImage, postPath),
    [coverImage, postPath],
  );

  const post = useMemo<BlogPost>(
    () => ({
      id: postPath,
      title: title || "Untitled Post",
      description: "",
      excerpt: "",
      date: new Date().toISOString(),
      year: safeYear,
      category: category || "General",
      tags,
      content,
      slug: safeSlug,
      language: "ko",
      readTime: readingTime,
      published,
      coverImage: normalizedCoverImage,
      defaultLanguage: "ko",
      availableLanguages: ["ko"],
    }),
    [
      category,
      content,
      normalizedCoverImage,
      postPath,
      published,
      readingTime,
      safeSlug,
      safeYear,
      tags,
      title,
    ],
  );

  const postView = useMemo<ResolvedPostViewModel>(
    () => ({
      year: post.year,
      slug: post.slug,
      title: post.title,
      description: post.description,
      excerpt: post.excerpt,
      content: post.content,
      categoryLabel: post.category,
      tagLabels: [...post.tags],
      readingTimeLabel,
      author: post.author,
      date: post.date,
      tags: [...post.tags],
    }),
    [post, readingTimeLabel],
  );

  return (
    <div
      className={cn(
        "min-h-full rounded-md bg-gradient-to-b from-[#f5f6fb] via-background to-background/70",
        isTerminal &&
          "bg-background from-background via-background to-background",
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 font-medium">
            {published ? "공개 미리보기" : "드래프트 미리보기"}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground/90">
            /blog/{safeYear}/{safeSlug}
          </span>
        </div>

        <div className="relative flex justify-center gap-8">
          <article
            className={cn(
              "w-full max-w-3xl space-y-8",
              isTerminal && "terminal-card p-4 sm:p-6",
            )}
          >
            <div className="pointer-events-none">
              <BlogPostHeader
                post={post}
                postView={postView}
                year={safeYear}
                slug={safeSlug}
                language="ko"
                setLanguage={() => {}}
                resolveLanguageName={resolveLanguageName}
                translationStatus="idle"
                aiTranslation={null}
                hasNativeTranslation
                translationError={null}
                onRetryTranslation={() => {}}
                isTerminal={isTerminal}
                preservedFrom={{ pathname: "/admin/new-post" }}
                preservedSearch=""
                onShare={() => {}}
                backToBlogLabel="에디터"
                shareLabel="공유"
                readingLanguageLabel="표시 언어"
                translatingLabel="번역 중"
                aiTranslatedLabel="AI 번역"
                translationFailedLabel="번역 실패"
                showingOriginalLabel="원문 표시 중"
                retryLabel="다시 시도"
              />
            </div>

            {normalizedCoverImage && (
              <div
                className={cn(
                  "overflow-hidden rounded-[28px] border border-white/50 bg-card/80 shadow-soft",
                  isTerminal && "rounded-lg border-border bg-card",
                )}
              >
                <img
                  src={normalizedCoverImage}
                  alt=""
                  loading="lazy"
                  className="h-auto w-full object-cover"
                />
              </div>
            )}

            <BlogPostContent
              content={content}
              inlineEnabled={false}
              postTitle={post.title}
              postPath={postPath}
              isTerminal={isTerminal}
            />
          </article>

          <aside className="hidden xl:block relative">
            <TableOfContents content={content} postTitle={post.title} />
          </aside>
        </div>
      </div>
    </div>
  );
}
