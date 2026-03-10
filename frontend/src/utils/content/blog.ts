import { type BlogPost, type SupportedLanguage } from '@/types/blog';

export interface FrontmatterData {
  title?: string;
  excerpt?: string;
  date?: string;
  category?: string;
  tags?: string[];
  readTime?: string | number;
}

export interface ParsedMarkdown {
  frontmatter: FrontmatterData;
  content: string;
}

export const formatDate = (
  dateString: string,
  language: SupportedLanguage = 'ko'
): string => {
  const date = new Date(dateString);
  const locale = language === 'en' ? 'en-US' : 'ko-KR';
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const calculateReadTime = (content: string): number => {
  const WORDS_PER_MINUTE = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / WORDS_PER_MINUTE);
};

export const createSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
};

export interface LocalizedPostContent {
  title: string;
  description: string;
  excerpt?: string;
  content: string;
}

const getFallbackLanguage = (post: BlogPost): SupportedLanguage =>
  post.defaultLanguage ?? 'ko';

export const getAvailableLanguages = (
  post: BlogPost
): SupportedLanguage[] => {
  const fallback = getFallbackLanguage(post);
  const available = (post.availableLanguages ?? []).filter(
    (lang): lang is SupportedLanguage => lang === 'ko' || lang === 'en'
  );
  return Array.from(new Set<SupportedLanguage>([fallback, ...available]));
};

export const resolveLocalizedPost = (
  post: BlogPost,
  language: SupportedLanguage
): LocalizedPostContent => {
  const fallbackLang = getFallbackLanguage(post);
  const base: LocalizedPostContent = {
    title: post.title,
    description: post.description,
    excerpt: post.excerpt,
    content: post.content,
  };

  if (language === fallbackLang) {
    return base;
  }

  const translation = post.translations?.[language];
  if (!translation) {
    return base;
  }

  return {
    title: translation.title || base.title,
    description: translation.description || base.description,
    excerpt: translation.excerpt || base.excerpt,
    content: translation.content || base.content,
  };
};

const parseMarkdownValue = (value: string): unknown => {
  // Remove quotes if present
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  // Parse arrays
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
};

export const parseMarkdownFrontmatter = (content: string): ParsedMarkdown => {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content };
  }

  const frontmatterText = match[1];
  const bodyContent = match[2];

  const frontmatter: FrontmatterData = {};
  frontmatterText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const rawValue = line.substring(colonIndex + 1).trim();
      const value = parseMarkdownValue(rawValue);

      (frontmatter as Record<string, unknown>)[key] = value;
    }
  });

  return { frontmatter, content: bodyContent };
};

/**
 * Parse description markdown to HTML, removing images and converting basic markdown
 * Used for post summary/excerpt display
 */
export const parseDescriptionMarkdown = (text: string): string => {
  if (!text) return '';
  
  const result = text
    // Remove image markdown: ![alt](src) or ![alt]
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]/g, '')
    // Remove standalone image URLs that look like paths
    .replace(/\(\/images\/[^)]+\)/g, '')
    // Convert bold: **text** or __text__
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    // Convert italic: *text* or _text_
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // Convert inline code: `code`
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
    // Convert headers to bold (### Header -> <strong>Header</strong>)
    .replace(/^#{1,6}\s+(.+)$/gm, '<strong>$1</strong>')
    // Convert links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline">$1</a>')
    // Clean up extra whitespace from removed images
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  return result;
};

export const loadPostBySlug = async (
  slug: string
): Promise<BlogPost | null> => {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const response = await fetch(`${baseUrl}posts/${slug}.md`);

    if (!response.ok) {
      return null;
    }

    const content = await response.text();
    const { frontmatter, content: bodyContent } =
      parseMarkdownFrontmatter(content);

    if (!frontmatter.title) {
      return null;
    }

    const readTime = frontmatter.readTime
      ? typeof frontmatter.readTime === 'string'
        ? parseInt(frontmatter.readTime, 10)
        : frontmatter.readTime
      : calculateReadTime(bodyContent);

    const year = frontmatter.date
      ? new Date(frontmatter.date).getFullYear().toString()
      : new Date().getFullYear().toString();

    return {
      id: slug.replace('/', '-'),
      title: frontmatter.title,
      description: frontmatter.excerpt || truncateText(bodyContent, 200),
      date: frontmatter.date || '',
      year,
      category: frontmatter.category || '기술',
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      slug,
      content: bodyContent,
      readTime,
    };
  } catch (error) {
    console.error(`Failed to load post ${slug}:`, error);
    return null;
  }
};
