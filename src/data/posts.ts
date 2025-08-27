import { PostService } from "../services/postService";
import type { BlogPost, BlogCategory, BlogTag } from "../types/blog";

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
  try {
    return await PostService.getPostBySlug(year, slug);
  } catch (error) {
    console.error(`Error loading post ${year}/${slug}:`, error);
    return null;
  }
};

// Legacy function for backward compatibility
export const getPostBySlugLegacy = async (
  slug: string,
): Promise<BlogPost | null> => {
  try {
    const posts = await PostService.getAllPosts();
    return (
      posts.find(
        (post) => post.slug === slug || `${post.year}/${post.slug}` === slug,
      ) || null
    );
  } catch (error) {
    console.error(`Error loading post ${slug}:`, error);
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
    const posts = await PostService.getAllPosts();
    const categoryMap = new Map<string, number>();

    posts.forEach((post) => {
      const count = categoryMap.get(post.category) || 0;
      categoryMap.set(post.category, count + 1);
    });

    return Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      count,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
    }));
  } catch (error) {
    console.error("Error loading categories:", error);
    return [];
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
