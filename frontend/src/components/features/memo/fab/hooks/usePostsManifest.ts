import { useEffect, useState } from "react";
import type { BlogPost } from "../types";

type PostsManifestResponse = {
  items?: BlogPost[];
};

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
        if (data.items) {
          setPosts(data.items.filter((p) => (p as BlogPost & { published?: boolean }).published !== false));
        }
      })
      .catch(() => setPosts([]));
  }, []);

  return posts;
}
