import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { BlogPost } from "../types";

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const VIRTUAL_FS_CONTROL_TEXT_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const VIRTUAL_FS_PATH_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;

export function normalizeVirtualFsText(value: unknown, fallback = ""): string {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(VIRTUAL_FS_CONTROL_TEXT_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

export function normalizeVirtualFsPathSegment(value: unknown, fallback = ""): string {
  const normalized = normalizeVirtualFsText(value, fallback);
  if (!normalized) return fallback;
  return normalized.replace(/[\\/]/g, "").trim() || fallback;
}

export function normalizeVirtualFsPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(VIRTUAL_FS_PATH_CONTROL_PATTERN, "")
    .replace(/\\/g, "")
    .trim();
  if (!normalized) return fallback;
  return normalized.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function getPostUrl(value: unknown): string {
  return normalizeVirtualFsPath(value, "");
}

function getPostSlugFromUrl(value: unknown): string {
  return normalizeVirtualFsPathSegment(getPostUrl(value).split("/").pop());
}

// Virtual filesystem hook
export function useVirtualFS(posts: BlogPost[]) {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive current path from URL
  const currentPath = useMemo(() => {
    const path = normalizeVirtualFsPath(location.pathname);
    if (path === "/" || path === "") return "/";
    if (path.startsWith("/blog/")) {
      // /blog/2025/post-slug -> /blog/2025
      const parts = path.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `/${parts.slice(0, 2).join("/")}`;
      }
    }
    return path;
  }, [location.pathname]);

  // Get current post info if viewing a post
  const currentPost = useMemo(() => {
    const path = normalizeVirtualFsPath(location.pathname);
    if (!path.startsWith("/blog/")) return null;
    const parts = path.split("/").filter(Boolean);
    // /blog/2025/post-slug has 3 parts
    if (parts.length >= 3) {
      const slug = parts[parts.length - 1];
      return (
        posts.find((p) => {
          const postSlug = getPostSlugFromUrl(p.url);
          return postSlug === slug;
        }) || null
      );
    }
    return null;
  }, [location.pathname, posts]);

  // Get shell-style display path (shorter, more readable)
  const displayPath = useMemo(() => {
    const path = normalizeVirtualFsPath(location.pathname);
    if (path === "/" || path === "") return "~";

    // Check different page types
    if (path === "/blog" || path === "/blog/") return "~/blog";
    if (path === "/about" || path === "/about/") return "~/about";
    if (path === "/guestbook" || path === "/guestbook/") return "~/guestbook";

    if (path.startsWith("/blog/")) {
      const parts = path.split("/").filter(Boolean);
      if (parts.length >= 3 && currentPost) {
        // Viewing a specific post - show year and truncated title
        const year = parts[1];
        const postTitle = normalizeVirtualFsText(currentPost.title, "post");
        const title =
          postTitle.length > 20
            ? `${postTitle.slice(0, 18)}..`
            : postTitle;
        return `~/${year}/${title}`;
      } else if (parts.length >= 2) {
        // Viewing year directory
        return `~/${parts[1]}`;
      }
    }

    // Default: show path without leading slash
    return `~${path}`;
  }, [location.pathname, currentPost]);

  // Get available years
  const years = useMemo(() => {
    const yearSet = new Set(
      posts.flatMap((p) => {
        const year = normalizeVirtualFsPathSegment(getPostUrl(p.url).split("/")[2]);
        return year ? [year] : [];
      }),
    );
    return Array.from(yearSet).sort().reverse();
  }, [posts]);

  // Get categories
  const categories = useMemo(() => {
    const catSet = new Set(posts.map((p) => normalizeVirtualFsText(p.category, "uncategorized")));
    return Array.from(catSet).sort();
  }, [posts]);

  // Get posts for current directory
  const getPostsInPath = useCallback(
    (path: string): BlogPost[] => {
      if (path === "/" || path === "/blog") {
        return [];
      }
      const parts = path.split("/").filter(Boolean);
      if (parts[0] === "blog" && parts.length >= 2) {
        const year = normalizeVirtualFsPathSegment(parts[1]);
        return posts.filter((p) => getPostUrl(p.url).includes(`/blog/${year}/`));
      }
      return [];
    },
    [posts],
  );

  // List directory contents
  const ls = useCallback(
    (path?: string): string => {
      const targetPath = normalizeVirtualFsPath(path || currentPath);

      if (targetPath === "/" || targetPath === "") {
        return "blog/\n";
      }

      if (targetPath === "/blog") {
        return `${years.map((y) => `${y}/`).join("\n")}\n`;
      }

      const parts = targetPath.split("/").filter(Boolean);
      if (parts[0] === "blog" && parts.length >= 2) {
        const year = normalizeVirtualFsPathSegment(parts[1]);
        const yearPosts = posts.filter((p) => getPostUrl(p.url).includes(`/blog/${year}/`));
        if (yearPosts.length === 0) {
          return `ls: ${targetPath}: No such directory`;
        }
        return yearPosts
          .map((p) => {
            const slug = getPostSlugFromUrl(p.url);
            return `${slug}.md`;
          })
          .join("\n");
      }

      return `ls: ${targetPath}: No such directory`;
    },
    [currentPath, years, posts],
  );

  // Change directory
  const cd = useCallback(
    (path: string): string => {
      const safePath = normalizeVirtualFsPath(path, "");
      if (!safePath || safePath === "~" || safePath === "/") {
        navigate("/");
        return "";
      }

      if (safePath === "..") {
        const parts = currentPath.split("/").filter(Boolean);
        if (parts.length <= 1) {
          navigate("/");
          return "";
        }
        const newPath = `/${parts.slice(0, -1).join("/")}`;
        if (newPath === "/blog") {
          navigate("/");
          return "";
        }
        navigate(newPath);
        return "";
      }

      // Handle absolute paths
      let targetPath = safePath;
      if (!safePath.startsWith("/")) {
        // Relative path
        if (currentPath === "/") {
          targetPath = `/${safePath}`;
        } else {
          targetPath = `${currentPath}/${safePath}`;
        }
      }

      // Clean up path
      targetPath = targetPath.replace(/\/+/g, "/").replace(/\/$/, "") || "/";

      // Validate path
      if (targetPath === "/blog") {
        navigate("/");
        return "";
      }

      const parts = targetPath.split("/").filter(Boolean);
      if (parts[0] === "blog" && parts.length >= 2) {
        const year = normalizeVirtualFsPathSegment(parts[1]);
        if (years.includes(year)) {
          // Navigate to year page (which shows filtered posts)
          navigate(`/blog?year=${year}`);
          return "";
        }
        return `cd: ${targetPath}: No such directory`;
      }

      if (targetPath === "/") {
        navigate("/");
        return "";
      }

      return `cd: ${targetPath}: No such directory`;
    },
    [currentPath, years, navigate],
  );

  // Print working directory
  const pwd = useCallback((): string => {
    return currentPath || "/";
  }, [currentPath]);

  // Cat file (navigate to post)
  const cat = useCallback(
    (filename: string): string => {
      const safeFilename = normalizeVirtualFsText(filename);
      if (!safeFilename) {
        return "cat: missing file operand";
      }

      // Remove .md extension if present
      const slug = normalizeVirtualFsPathSegment(safeFilename.replace(/\.md$/, ""));

      // Find matching post
      const post = posts.find((p) => {
        const postSlug = getPostSlugFromUrl(p.url);
        return (
          postSlug === slug || postSlug?.toLowerCase() === slug.toLowerCase()
        );
      });

      if (post) {
        navigate(getPostUrl(post.url));
        return `Opening: ${normalizeVirtualFsText(post.title, "Untitled")}`;
      }

      return `cat: ${safeFilename}: No such file`;
    },
    [posts, navigate],
  );

  // Find posts by keyword
  const find = useCallback(
    (keyword: string): string => {
      const safeKeyword = normalizeVirtualFsText(keyword);
      if (!safeKeyword) {
        return "find: missing search term";
      }

      const kw = safeKeyword.toLowerCase();
      const matches = posts.filter(
        (p) =>
          normalizeVirtualFsText(p.title).toLowerCase().includes(kw) ||
          normalizeVirtualFsText(p.slug).toLowerCase().includes(kw) ||
          p.tags?.some((t) => normalizeVirtualFsText(t).toLowerCase().includes(kw)) ||
          normalizeVirtualFsText(p.category).toLowerCase().includes(kw),
      );

      if (matches.length === 0) {
        return `No posts found matching: ${safeKeyword}`;
      }

      return (
        matches
          .slice(0, 10)
          .map((p) => {
            const path = getPostUrl(p.url);
            const title = normalizeVirtualFsText(p.title, "Untitled");
            return `${path}  ${title.slice(0, 30)}${title.length > 30 ? "..." : ""}`;
          })
          .join("\n") +
        (matches.length > 10 ? `\n... and ${matches.length - 10} more` : "")
      );
    },
    [posts],
  );

  // Tree view of blog structure
  const tree = useCallback((): string => {
    let output = "/\n└── blog/\n";

    years.forEach((year, yi) => {
      const isLast = yi === years.length - 1;
      const prefix = isLast ? "    └── " : "    ├── ";
      const safeYear = normalizeVirtualFsPathSegment(year);
      const yearPosts = posts.filter((p) => getPostUrl(p.url).includes(`/blog/${safeYear}/`));
      output += `${prefix}${safeYear}/ (${yearPosts.length} posts)\n`;
    });

    return output;
  }, [years, posts]);

  return {
    currentPath,
    displayPath,
    currentPost,
    years,
    categories,
    getPostsInPath,
    ls,
    cd,
    pwd,
    cat,
    find,
    tree,
    navigate,
  };
}
