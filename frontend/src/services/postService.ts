/// <reference types="vite/client" />
import matter from 'gray-matter';
import type { BlogPost, PostsPage } from '../types/blog';

type ManifestItem = {
  path: string; // /posts/:year/:file.md
  year: string;
  slug: string;
  title: string;
  description: string;
  snippet?: string;
  date: string;
  tags: string[];
  category: string;
  author?: string;
  readingTime?: string;
  published?: boolean;
  coverImage?: string;
  url?: string;
};

type UnifiedManifest = {
  total: number;
  items: ManifestItem[];
  generatedAt: string;
  years: string[];
  format?: number;
};

export class PostService {
  private static postsCache: BlogPost[] | null = null; // metadata-only cache
  private static manifestCache: UnifiedManifest | null = null;
  private static contentCache: Map<string, string> = new Map(); // key: year/slug -> markdown content
  private static pageCache: Map<string, PostsPage<BlogPost>> = new Map();

  // Query for paginated metadata
  static readonly DEFAULT_PAGE_SIZE = 12;
  static readonly SORTS = ['date', 'title', 'readTime'] as const;

  private static getBasePath(): string {
    // Vite injects BASE_URL with a trailing slash (e.g., '/', '/blog/').
    // Normalize by removing the trailing slash so we can safely concatenate paths.
    const base = import.meta.env.BASE_URL ?? '/';
    return base.replace(/\/$/, '');
  }

  private static buildPageKey(q: {
    page: number;
    pageSize: number;
    category?: string;
    tags?: string[];
    search?: string;
    sort?: 'date' | 'title' | 'readTime';
  }): string {
    const normalized = {
      ...q,
      tags: (q.tags || []).slice().sort(),
      category: q.category || 'all',
      search: (q.search || '').trim().toLowerCase(),
      sort: q.sort || 'date',
    };
    return JSON.stringify(normalized);
  }

  private static applyFiltersAndSort(
    items: ManifestItem[],
    q: {
      category?: string;
      tags?: string[];
      search?: string;
      sort?: 'date' | 'title' | 'readTime';
    }
  ): ManifestItem[] {
    const search = (q.search || '').trim().toLowerCase();
    const category =
      q.category && q.category !== 'all' ? q.category : undefined;
    const requiredTags = (q.tags || []).filter(Boolean);

    let filtered = items.filter(it => it.published !== false);
    if (category) {
      filtered = filtered.filter(it => it.category === category);
    }
    if (requiredTags.length) {
      filtered = filtered.filter(it =>
        requiredTags.every(t => it.tags?.includes(t))
      );
    }
    if (search) {
      filtered = filtered.filter(
        it =>
          it.title.toLowerCase().includes(search) ||
          (it.description || '').toLowerCase().includes(search) ||
          (it.snippet || '').toLowerCase().includes(search) ||
          (it.category || '').toLowerCase().includes(search) ||
          (it.tags || []).some(t => t.toLowerCase().includes(search))
      );
    }

    const sortKey = q.sort || 'date';
    filtered.sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title);
      if (sortKey === 'readTime') {
        // readingTime like "5 min read" -> parse leading int
        const parse = (s?: string) => (s ? parseInt(String(s), 10) || 0 : 0);
        return parse(a.readingTime) - parse(b.readingTime);
      }
      // default by date desc
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return filtered;
  }

  static async getPostsPage(q: {
    page?: number;
    pageSize?: number;
    category?: string;
    tags?: string[];
    search?: string;
    sort?: 'date' | 'title' | 'readTime';
  }): Promise<PostsPage<BlogPost>> {
    const page = Math.max(1, q.page || 1);
    const pageSize = Math.max(1, q.pageSize || PostService.DEFAULT_PAGE_SIZE);
    const key = this.buildPageKey({ ...q, page, pageSize });
    const cached = this.pageCache.get(key);
    if (cached) return cached;

    const items = await this.getManifestItems();
    const filtered = this.applyFiltersAndSort(items, q);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);

    const resultItems: BlogPost[] = slice.map(it => ({
      id: it.slug,
      title: it.title,
      description: it.description,
      excerpt: it.snippet || it.description,
      content: '',
      date: it.date,
      author: it.author || 'Admin',
      tags: it.tags || [],
      category: it.category,
      readingTime: it.readingTime,
      slug: it.slug,
      year: it.year,
      published: true,
      coverImage: it.coverImage,
    }));

    const pageResult: PostsPage<BlogPost> = {
      items: resultItems,
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    };

    this.pageCache.set(key, pageResult);
    return pageResult;
  }

  static async prefetchPost(year: string, slug: string): Promise<void> {
    const items = await this.getManifestItems();
    const item = items.find(i => i.year === year && i.slug === slug);
    if (!item) return;
    const key = `${year}/${slug}`;
    if (this.contentCache.has(key)) return;
    try {
      const markdown = await this.loadMarkdownFile(item.path);
      this.contentCache.set(key, markdown);
    } catch {
      // ignore prefetch errors
    }
  }

  private static async loadPostsManifest(): Promise<
    UnifiedManifest | { posts: string[] } | null
  > {
    try {
      const base = this.getBasePath();
      const response = await fetch(`${base}/posts-manifest.json`, {
        // Favor fresh-ish metadata but allow cached when offline
        cache: 'force-cache',
      });
      if (!response.ok) {
        throw new Error('Failed to load posts manifest');
      }
      return await response.json();
    } catch (error) {
      console.error('Error loading posts manifest:', error);
      return null;
    }
  }

  private static async loadMarkdownFile(path: string): Promise<string> {
    try {
      const base = this.getBasePath();
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const url = `${base}${normalizedPath}`;
      const response = await fetch(url);
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
    filePath: string
  ): Partial<BlogPost> {
    const { data: frontMatter, content: markdownContent } = matter(content);
    // Simple reading time calculation: ~200 words per minute
    const wordCount = markdownContent
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));
    const readingTimeText = `${readingMinutes} min read`;

    // Extract year and filename from /posts/:year/:slug.md
    const match = filePath.match(/\/posts\/(\d{4})\/(.+)\.md$/);
    const year = match?.[1] ?? new Date().getFullYear().toString();
    const filename =
      match?.[2] ?? filePath.split('/').pop()?.replace('.md', '') ?? 'post';

    return {
      id: filename,
      title:
        frontMatter.title ||
        filename.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description:
        frontMatter.description || `${markdownContent.substring(0, 150)}...`,
      excerpt:
        frontMatter.excerpt ||
        frontMatter.description ||
        `${markdownContent.substring(0, 150)}...`,
      content: markdownContent,
      date: frontMatter.date || `${year}-01-01`,
      author: frontMatter.author || 'Admin',
      tags: Array.isArray(frontMatter.tags) ? frontMatter.tags : [],
      category: frontMatter.category || 'General',
      readingTime: readingTimeText,
      slug: filename,
      year,
      published: frontMatter.published !== false,
      coverImage: frontMatter.coverImage,
    };
  }

  private static async getManifestItems(): Promise<ManifestItem[]> {
    if (this.manifestCache) return this.manifestCache.items;
    const manifest = await this.loadPostsManifest();
    if (!manifest) return [];

    // New format with items
    if ((manifest as UnifiedManifest).items) {
      this.manifestCache = manifest as UnifiedManifest;
      return this.manifestCache.items;
    }

    // Fallback: old format with posts array -> build items by reading each markdown frontmatter
    const old = manifest as { posts: string[] };
    if (!old.posts?.length) return [];

    const items: ManifestItem[] = [];
    for (const postPath of old.posts) {
      try {
        const content = await this.loadMarkdownFile(postPath);
        const parsed = this.parseMarkdownContent(content, postPath);
        if (parsed.published === false) continue;
        items.push({
          path: postPath,
          year: parsed.year!,
          slug: parsed.slug!,
          title: parsed.title!,
          description: parsed.description!,
          snippet: parsed.excerpt || parsed.description,
          date: parsed.date!,
          tags: parsed.tags || [],
          category: parsed.category!,
          author: parsed.author,
          readingTime: parsed.readingTime,
          published: true,
          coverImage: parsed.coverImage,
          url: `/blog/${parsed.year}/${parsed.slug}`,
        });
      } catch (e) {
        console.warn(`Failed to parse legacy post ${postPath}:`, e);
      }
    }
    // Sort desc by date
    items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    this.manifestCache = {
      total: items.length,
      items,
      generatedAt: new Date().toISOString(),
      years: Array.from(new Set(items.map(i => i.year)))
        .sort()
        .reverse(),
      format: 1,
    };
    return items;
  }

  static async getAllPosts(): Promise<BlogPost[]> {
    if (this.postsCache) return this.postsCache;

    const items = await this.getManifestItems();
    // Map metadata to BlogPost shape with empty content to satisfy type
    const posts: BlogPost[] = items
      .filter(it => it.published !== false)
      .map(it => ({
        id: it.slug,
        title: it.title,
        description: it.description,
        excerpt: it.snippet || it.description,
        content: '', // lazy-loaded on demand
        date: it.date,
        author: it.author || 'Admin',
        tags: it.tags || [],
        category: it.category,
        readingTime: it.readingTime,
        slug: it.slug,
        year: it.year,
        published: true,
        coverImage: it.coverImage,
      }));

    this.postsCache = posts;
    return posts;
  }

  static async getPostBySlug(
    year: string,
    slug: string
  ): Promise<BlogPost | null> {
    const key = `${year}/${slug}`;
    const items = await this.getManifestItems();
    const item = items.find(i => i.year === year && i.slug === slug);
    if (!item) return null;

    // Try cache
    if (this.contentCache.has(key)) {
      const markdown = this.contentCache.get(key)!;
      const parsed = this.parseMarkdownContent(markdown, item.path);
      return {
        id: parsed.id!,
        title: parsed.title!,
        description: parsed.description!,
        excerpt: parsed.excerpt!,
        content: parsed.content!,
        date: parsed.date!,
        author: parsed.author!,
        tags: parsed.tags!,
        category: parsed.category!,
        readingTime: parsed.readingTime!,
        slug: parsed.slug!,
        year: parsed.year!,
        published: true,
        coverImage: parsed.coverImage,
      };
    }

    // Fetch only this post's markdown
    const markdown = await this.loadMarkdownFile(item.path);
    this.contentCache.set(key, markdown);
    const parsed = this.parseMarkdownContent(markdown, item.path);
    return {
      id: parsed.id!,
      title: parsed.title!,
      description: parsed.description!,
      excerpt: parsed.excerpt!,
      content: parsed.content!,
      date: parsed.date!,
      author: parsed.author!,
      tags: parsed.tags!,
      category: parsed.category!,
      readingTime: parsed.readingTime!,
      slug: parsed.slug!,
      year: parsed.year!,
      published: true,
      coverImage: parsed.coverImage,
    };
  }

  static async getPostsByCategory(category: string): Promise<BlogPost[]> {
    const posts = await this.getAllPosts();
    return posts.filter(
      post => post.category.toLowerCase() === category.toLowerCase()
    );
  }

  static async getPostsByTag(tag: string): Promise<BlogPost[]> {
    const posts = await this.getAllPosts();
    return posts.filter(post =>
      post.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );
  }

  static async searchPosts(query: string): Promise<BlogPost[]> {
    const posts = await this.getAllPosts();
    const lowercaseQuery = query.toLowerCase();

    return posts.filter(
      post =>
        post.title.toLowerCase().includes(lowercaseQuery) ||
        post.description.toLowerCase().includes(lowercaseQuery) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(lowercaseQuery)) ||
        post.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
        post.category.toLowerCase().includes(lowercaseQuery)
    );
  }

  static clearCache(): void {
    this.postsCache = null;
    this.manifestCache = null;
    this.contentCache.clear();
    this.pageCache.clear();
  }
}
