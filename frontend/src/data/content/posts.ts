import { PostService } from "@/services/content/postService";
import type { BlogPost, BlogCategory, BlogTag, PostsPage } from "@/types/blog";

const POST_PATH_SEGMENT_UNSAFE_PATTERN = /[\u0000-\u001F\u007F/\\]/;
const LEGACY_POST_LOOKUP_UNSAFE_PATTERN = /[\u0000-\u001F\u007F\\]/;

function normalizePostPathSegment(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || POST_PATH_SEGMENT_UNSAFE_PATTERN.test(trimmed)) return null;

  try {
    const decoded = decodeURIComponent(trimmed);
    return decoded && !POST_PATH_SEGMENT_UNSAFE_PATTERN.test(decoded)
      ? trimmed
      : null;
  } catch {
    return null;
  }
}

function normalizeLegacyPostLookupSlug(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || LEGACY_POST_LOOKUP_UNSAFE_PATTERN.test(trimmed)) return null;

  const segments = trimmed.split("/");
  if (
    segments.length > 2 ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }

  for (const segment of segments) {
    try {
      const decoded = decodeURIComponent(segment);
      if (
        !decoded ||
        decoded === "." ||
        decoded === ".." ||
        POST_PATH_SEGMENT_UNSAFE_PATTERN.test(decoded)
      ) {
        return null;
      }
    } catch {
      return null;
    }
  }

  return trimmed;
}

// Main function to get all posts from markdown files
export const getPosts = async (): Promise<BlogPost[]> => {
  try {
    return await PostService.getAllPosts();
  } catch (error) {
    console.error("Error loading posts:", error);
    return [];
  }
};

// Get a single post by year and slug
export const getPostBySlug = async (
  year: string,
  slug: string,
): Promise<BlogPost | null> => {
  const safeYear = normalizePostPathSegment(year);
  const safeSlug = normalizePostPathSegment(slug);
  if (!safeYear || !safeSlug) return null;

  try {
    return await PostService.getPostBySlug(safeYear, safeSlug);
  } catch (error) {
    console.error(`Error loading post ${safeYear}/${safeSlug}:`, error);
    return null;
  }
};

// Paginated posts (metadata-only) with server-side filters/sort
export type PostsQuery = {
  page?: number;
  pageSize?: number;
  category?: string;
  tags?: string[];
  search?: string;
  sort?: "date" | "title" | "readTime";
};

export const getPostsPage = async (
  q: PostsQuery,
): Promise<PostsPage<BlogPost>> => {
  try {
    return await PostService.getPostsPage(q);
  } catch (error) {
    console.error("Error loading paginated posts:", error);
    return {
      items: [],
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 12,
      total: 0,
      totalPages: 1,
      hasMore: false,
    };
  }
};

// Prefetch a single post's markdown content (fire-and-forget)
export const prefetchPost = async (
  year: string,
  slug: string,
): Promise<void> => {
  const safeYear = normalizePostPathSegment(year);
  const safeSlug = normalizePostPathSegment(slug);
  if (!safeYear || !safeSlug) return;

  try {
    await PostService.prefetchPost(safeYear, safeSlug);
  } catch {
    // ignore prefetch errors
  }
};

// Legacy function for backward compatibility
export const getPostBySlugLegacy = async (
  slug: string,
): Promise<BlogPost | null> => {
  const safeSlug = normalizeLegacyPostLookupSlug(slug);
  if (!safeSlug) return null;

  try {
    const posts = await PostService.getAllPosts();
    return (
      posts.find(
        (post) =>
          post.slug === safeSlug || `${post.year}/${post.slug}` === safeSlug,
      ) || null
    );
  } catch (error) {
    console.error(`Error loading post ${safeSlug}:`, error);
    return null;
  }
};

// Get posts by category
export const getPostsByCategory = async (
  category: string,
): Promise<BlogPost[]> => {
  try {
    return await PostService.getPostsByCategory(category);
  } catch (error) {
    console.error(`Error loading posts for category ${category}:`, error);
    return [];
  }
};

// Get posts by tag
export const getPostsByTag = async (tag: string): Promise<BlogPost[]> => {
  try {
    return await PostService.getPostsByTag(tag);
  } catch (error) {
    console.error(`Error loading posts for tag ${tag}:`, error);
    return [];
  }
};

// Search posts
export const searchPosts = async (query: string): Promise<BlogPost[]> => {
  try {
    return await PostService.searchPosts(query);
  } catch (error) {
    console.error(`Error searching posts with query "${query}":`, error);
    return [];
  }
};

// Get categories with post counts
export const getCategories = async (): Promise<BlogCategory[]> => {
  try {
    const categoryMap = await PostService.getCategoryCounts();

    return Object.entries(categoryMap).map(([name, count]) => ({
      name,
      count,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
    }));
  } catch (error) {
    console.error("Error loading categories:", error);
    return [];
  }
};

export const getPostCategoryCounts = async (): Promise<
  Record<string, number>
> => {
  try {
    return await PostService.getCategoryCounts();
  } catch (error) {
    console.error("Error loading category counts:", error);
    return {};
  }
};

// Get tags with post counts
export const getTags = async (): Promise<BlogTag[]> => {
  try {
    const posts = await PostService.getAllPosts();
    const tagMap = new Map<string, number>();

    posts.forEach((post) => {
      post.tags.forEach((tag) => {
        const count = tagMap.get(tag) || 0;
        tagMap.set(tag, count + 1);
      });
    });

    return Array.from(tagMap.entries()).map(([name, count]) => ({
      name,
      count,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
    }));
  } catch (error) {
    console.error("Error loading tags:", error);
    return [];
  }
};

// Get all unique categories
export const getAllCategories = async (): Promise<string[]> => {
  try {
    const posts = await PostService.getAllPosts();
    const categories = new Set(posts.map((post) => post.category));
    return Array.from(categories);
  } catch (error) {
    console.error("Error loading categories:", error);
    return [];
  }
};

// Get all unique tags
export const getAllTags = async (): Promise<string[]> => {
  try {
    const posts = await PostService.getAllPosts();
    const tags = new Set(posts.flatMap((post) => post.tags));
    return Array.from(tags);
  } catch (error) {
    console.error("Error loading tags:", error);
    return [];
  }
};

export const getPostsBySeries = async (series: string): Promise<BlogPost[]> => {
  try {
    const posts = await PostService.getAllPosts();
    return posts.filter(
      (post) =>
        post.series && post.series.toLowerCase() === series.toLowerCase(),
    );
  } catch (error) {
    console.error(`Error loading posts for series ${series}:`, error);
    return [];
  }
};

// Clear cache (useful for development)
export const clearPostsCache = (): void => {
  PostService.clearCache();
};

// Legacy support - keep existing variable export for backward compatibility
let posts: BlogPost[] = [];
let postsLoaded = false;

const initializePosts = async () => {
  if (!postsLoaded) {
    posts = await getPosts();
    postsLoaded = true;
  }
};

// Start loading posts
initializePosts();

export { posts };
