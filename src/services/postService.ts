import matter from "gray-matter";
import readingTime from "reading-time";
import type { BlogPost } from "../types/blog";

export class PostService {
  private static postsCache: BlogPost[] | null = null;

  private static async loadPostsManifest(): Promise<any> {
    try {
      const response = await fetch("/blog/posts-manifest.json");
      if (!response.ok) {
        throw new Error("Failed to load posts manifest");
      }
      return await response.json();
    } catch (error) {
      console.error("Error loading posts manifest:", error);
      return null;
    }
  }

  private static async loadMarkdownFile(path: string): Promise<string> {
    try {
      const response = await fetch(`/blog${path}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${path}`);
      }
      return await response.text();
    } catch (error) {
      console.error(`Error loading markdown file ${path}:`, error);
      throw error;
    }
  }

  private static parseMarkdownContent(
    content: string,
    filePath: string,
  ): Partial<BlogPost> {
    const { data: frontMatter, content: markdownContent } = matter(content);
    const stats = readingTime(markdownContent);

    // Extract year and filename from path
    const pathParts = filePath.split("/");
    const filename = pathParts[pathParts.length - 1].replace(".md", "");
    const year = pathParts.includes("2024")
      ? "2024"
      : pathParts.includes("2025")
        ? "2025"
        : new Date().getFullYear().toString();

    return {
      id: filename,
      title:
        frontMatter.title ||
        filename.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      description:
        frontMatter.description || markdownContent.substring(0, 150) + "...",
      excerpt:
        frontMatter.excerpt ||
        frontMatter.description ||
        markdownContent.substring(0, 150) + "...",
      content: markdownContent,
      date: frontMatter.date || `${year}-01-01`,
      author: frontMatter.author || "Admin",
      tags: frontMatter.tags || [],
      category: frontMatter.category || "General",
      readingTime: stats.text,
      slug: filename,
      year: year,
      published: frontMatter.published !== false,
      coverImage: frontMatter.coverImage,
    };
  }

  static async getAllPosts(): Promise<BlogPost[]> {
    if (this.postsCache) {
      return this.postsCache;
    }

    const manifest = await this.loadPostsManifest();
    if (!manifest || !manifest.posts) {
      console.warn("Posts manifest not available, returning empty array");
      return [];
    }

    const posts: BlogPost[] = [];

    for (const postPath of manifest.posts) {
      try {
        const content = await this.loadMarkdownFile(postPath);
        const postData = this.parseMarkdownContent(content, postPath);

        if (postData.published !== false) {
          posts.push({
            id: postData.id!,
            title: postData.title!,
            description: postData.description!,
            excerpt: postData.excerpt!,
            content: postData.content!,
            date: postData.date!,
            author: postData.author!,
            tags: postData.tags!,
            category: postData.category!,
            readingTime: postData.readingTime!,
            slug: postData.slug!,
            year: postData.year!,
            published: true,
            coverImage: postData.coverImage,
          });
        }
      } catch (error) {
        console.error(`Failed to load post from ${postPath}:`, error);
      }
    }

    // Sort by date (newest first)
    posts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    this.postsCache = posts;
    return posts;
  }

  static async getPostBySlug(
    year: string,
    slug: string,
  ): Promise<BlogPost | null> {
    const posts = await this.getAllPosts();
    return (
      posts.find((post) => post.year === year && post.slug === slug) || null
    );
  }

  static async getPostsByCategory(category: string): Promise<BlogPost[]> {
    const posts = await this.getAllPosts();
    return posts.filter(
      (post) => post.category.toLowerCase() === category.toLowerCase(),
    );
  }

  static async getPostsByTag(tag: string): Promise<BlogPost[]> {
    const posts = await this.getAllPosts();
    return posts.filter((post) =>
      post.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
    );
  }

  static async searchPosts(query: string): Promise<BlogPost[]> {
    const posts = await this.getAllPosts();
    const lowercaseQuery = query.toLowerCase();

    return posts.filter(
      (post) =>
        post.title.toLowerCase().includes(lowercaseQuery) ||
        post.description.toLowerCase().includes(lowercaseQuery) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(lowercaseQuery)) ||
        post.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)) ||
        post.category.toLowerCase().includes(lowercaseQuery),
    );
  }

  static clearCache(): void {
    this.postsCache = null;
  }
}
