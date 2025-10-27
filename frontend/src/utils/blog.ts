import { BlogPost } from '@/types/blog';

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

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
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
