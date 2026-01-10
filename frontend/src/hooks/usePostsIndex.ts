import { useState, useEffect, useCallback } from 'react';
import { getPosts } from '@/data/posts';
import type { BlogPost } from '@/types/blog';

/**
 * 전역 포스트 인덱스 훅
 * 앱 전체에서 검색 등에 사용할 수 있도록 포스트 메타데이터를 로드하고 캐시합니다.
 */

// 싱글톤 캐시 - 여러 컴포넌트에서 사용해도 한 번만 로드
let cachedPosts: BlogPost[] | null = null;
let loadingPromise: Promise<BlogPost[]> | null = null;

export function usePostsIndex() {
  const [posts, setPosts] = useState<BlogPost[]>(cachedPosts || []);
  const [loading, setLoading] = useState(!cachedPosts);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // 이미 캐시가 있으면 바로 반환
    if (cachedPosts) {
      setPosts(cachedPosts);
      setLoading(false);
      return;
    }

    // 이미 로딩 중이면 그 Promise를 사용
    if (loadingPromise) {
      loadingPromise.then(result => {
        setPosts(result);
        setLoading(false);
      }).catch(err => {
        setError(err);
        setLoading(false);
      });
      return;
    }

    // 새로 로드
    setLoading(true);
    loadingPromise = getPosts();

    loadingPromise
      .then(result => {
        cachedPosts = result;
        setPosts(result);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
        loadingPromise = null;
      });
  }, []);

  // 강제 리프레시 함수 (필요 시)
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPosts();
      cachedPosts = result;
      setPosts(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    posts,
    loading,
    error,
    refresh,
    // 편의 메서드들
    getPostBySlug: useCallback((year: string, slug: string) => {
      return posts.find(p => p.year === year && p.slug === slug) || null;
    }, [posts]),
    searchPosts: useCallback((query: string) => {
      if (!query.trim()) return posts;
      const q = query.toLowerCase();
      return posts.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some(t => t.toLowerCase().includes(q)) ||
        p.category?.toLowerCase().includes(q)
      );
    }, [posts]),
  };
}

export default usePostsIndex;
