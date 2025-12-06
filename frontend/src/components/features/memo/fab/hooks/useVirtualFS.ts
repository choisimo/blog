import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { BlogPost } from "../types";

// Virtual filesystem hook
export function useVirtualFS(posts: BlogPost[]) {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive current path from URL
  const currentPath = useMemo(() => {
    const path = location.pathname;
    if (path === "/" || path === "") return "/";
    if (path.startsWith("/blog/")) {
      // /blog/2025/post-slug -> /blog/2025
      const parts = path.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return "/" + parts.slice(0, 2).join("/");
      }
    }
    return path;
  }, [location.pathname]);

  // Get current post info if viewing a post
  const currentPost = useMemo(() => {
    const path = location.pathname;
    if (!path.startsWith("/blog/")) return null;
    const parts = path.split("/").filter(Boolean);
    // /blog/2025/post-slug has 3 parts
    if (parts.length >= 3) {
      const slug = parts[parts.length - 1];
      return (
        posts.find((p) => {
          const postSlug = p.url.split("/").pop();
          return postSlug === slug;
        }) || null
      );
    }
    return null;
  }, [location.pathname, posts]);

  // Get shell-style display path (shorter, more readable)
  const displayPath = useMemo(() => {
    const path = location.pathname;
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
        const title =
          currentPost.title.length > 20
            ? currentPost.title.slice(0, 18) + ".."
            : currentPost.title;
        return `~/${year}/${title}`;
      } else if (parts.length >= 2) {
        // Viewing year directory
        const year = parts[1];
        return `~/${year}`;
      }
    }

    // Default: show path without leading slash
    return "~" + path;
  }, [location.pathname, currentPost]);

  // Get available years
  const years = useMemo(() => {
    const yearSet = new Set(posts.map((p) => p.url.split("/")[2]));
    return Array.from(yearSet).sort().reverse();
  }, [posts]);

  // Get categories
  const categories = useMemo(() => {
    const catSet = new Set(posts.map((p) => p.category));
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
        const year = parts[1];
        return posts.filter((p) => p.url.includes(`/blog/${year}/`));
      }
      return [];
    },
    [posts],
  );

  // List directory contents
  const ls = useCallback(
    (path?: string): string => {
      const targetPath = path || currentPath;

      if (targetPath === "/" || targetPath === "") {
        return "blog/\n";
      }

      if (targetPath === "/blog") {
        return years.map((y) => `${y}/`).join("\n") + "\n";
      }

      const parts = targetPath.split("/").filter(Boolean);
      if (parts[0] === "blog" && parts.length >= 2) {
        const year = parts[1];
        const yearPosts = posts.filter((p) => p.url.includes(`/blog/${year}/`));
        if (yearPosts.length === 0) {
          return `ls: ${targetPath}: No such directory`;
        }
        return yearPosts
          .map((p) => {
            const slug = p.url.split("/").pop();
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
      if (!path || path === "~" || path === "/") {
        navigate("/");
        return "";
      }

      if (path === "..") {
        const parts = currentPath.split("/").filter(Boolean);
        if (parts.length <= 1) {
          navigate("/");
          return "";
        }
        const newPath = "/" + parts.slice(0, -1).join("/");
        if (newPath === "/blog") {
          navigate("/");
          return "";
        }
        navigate(newPath);
        return "";
      }

      // Handle absolute paths
      let targetPath = path;
      if (!path.startsWith("/")) {
        // Relative path
        if (currentPath === "/") {
          targetPath = "/" + path;
        } else {
          targetPath = currentPath + "/" + path;
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
        const year = parts[1];
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
      if (!filename) {
        return "cat: missing file operand";
      }

      // Remove .md extension if present
      const slug = filename.replace(/\.md$/, "");

      // Find matching post
      const post = posts.find((p) => {
        const postSlug = p.url.split("/").pop();
        return (
          postSlug === slug || postSlug?.toLowerCase() === slug.toLowerCase()
        );
      });

      if (post) {
        navigate(post.url);
        return `Opening: ${post.title}`;
      }

      return `cat: ${filename}: No such file`;
    },
    [posts, navigate],
  );

  // Find posts by keyword
  const find = useCallback(
    (keyword: string): string => {
      if (!keyword) {
        return "find: missing search term";
      }

      const kw = keyword.toLowerCase();
      const matches = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(kw) ||
          p.slug?.toLowerCase().includes(kw) ||
          p.tags?.some((t) => t.toLowerCase().includes(kw)) ||
          p.category?.toLowerCase().includes(kw),
      );

      if (matches.length === 0) {
        return `No posts found matching: ${keyword}`;
      }

      return (
        matches
          .slice(0, 10)
          .map((p) => {
            const path = p.url;
            return `${path}  ${p.title.slice(0, 30)}${p.title.length > 30 ? "..." : ""}`;
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
      const yearPosts = posts.filter((p) => p.url.includes(`/blog/${year}/`));
      output += `${prefix}${year}/ (${yearPosts.length} posts)\n`;
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
