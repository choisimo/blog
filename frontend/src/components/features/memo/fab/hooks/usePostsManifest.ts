import { useEffect, useState } from "react";
import type { BlogPost } from "../types";

// Hook to load posts manifest
export function usePostsManifest(): BlogPost[] {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    fetch("/posts-manifest.json")
      .then((res) => res.json())
      .then((data) => {
        if (data.items) {
          setPosts(data.items.filter((p: any) => p.published !== false));
        }
      })
      .catch(() => setPosts([]));
  }, []);

  return posts;
}
