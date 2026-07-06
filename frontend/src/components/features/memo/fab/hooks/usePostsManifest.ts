import { useEffect, useState } from "react";
import type { BlogPost } from "../types";

type PostsManifestResponse = {
  items?: BlogPost[];
};

type ManifestPost = Partial<BlogPost> & {
  published?: boolean;
};

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const MANIFEST_CONTROL_TEXT_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MANIFEST_PATH_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const MALFORMED_PERCENT_PATTERN = /%(?![0-9A-Fa-f]{2})/;

export function normalizePostsManifestText(value: unknown, fallback = ""): string {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(MANIFEST_CONTROL_TEXT_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
}

function normalizePostsManifestPathSegment(value: unknown, fallback = ""): string {
  return normalizePostsManifestText(value, fallback)
    .replace(/[\\/]/g, "")
    .trim() || fallback;
}

function normalizePostsManifestUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(MANIFEST_PATH_CONTROL_PATTERN, "")
    .replace(/\\/g, "")
    .trim();

  if (!url || !url.startsWith("/") || url.startsWith("//") || MALFORMED_PERCENT_PATTERN.test(url)) {
    return null;
  }

  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(url);
  } catch {
    return null;
  }

  if (MANIFEST_PATH_CONTROL_PATTERN.test(decodedUrl) || decodedUrl.includes("\\")) {
    return null;
  }

  return url.replace(/\/+/g, "/");
}

export function normalizePostsManifestItems(items: unknown): BlogPost[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    const post = item as ManifestPost;
    if (post.published === false) return [];

    const url = normalizePostsManifestUrl(post.url);
    if (!url) return [];

    const slugFromUrl = url.split("/").pop();

    return [
      {
        slug: normalizePostsManifestPathSegment(post.slug ?? slugFromUrl, "post"),
        title: normalizePostsManifestText(post.title, "Untitled"),
        category: normalizePostsManifestText(post.category, "uncategorized"),
        date: normalizePostsManifestText(post.date),
        tags: Array.isArray(post.tags)
          ? post.tags.flatMap((tag) => {
              const normalized = normalizePostsManifestText(tag);
              return normalized ? [normalized] : [];
            })
          : [],
        url,
      },
    ];
  });
}

// Hook to load posts manifest
export function usePostsManifest(): BlogPost[] {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/';
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const url = `${normalizedBase}/posts-manifest.json?ts=${Date.now()}`;

    fetch(url, { cache: 'no-cache' })
      .then((res) => res.json() as Promise<PostsManifestResponse>)
      .then((data) => {
        setPosts(normalizePostsManifestItems(data.items));
      })
      .catch(() => setPosts([]));
  }, []);

  return posts;
}
