import { BlogPost } from '@/types/blog';

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const calculateReadTime = (content: string): number => {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
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
  return text.slice(0, maxLength).trim() + '...';
};

function parseMarkdownFrontmatter(content: string): { frontmatter: any; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, content };
  }
  
  const frontmatterText = match[1];
  const bodyContent = match[2];
  
  const frontmatter: any = {};
  frontmatterText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          value = JSON.parse(value);
        } catch {
          // If JSON parsing fails, treat as string
        }
      }
      
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, content: bodyContent };
}

export const loadPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const response = await fetch(`${baseUrl}posts/${slug}.md`);
    
    if (!response.ok) {
      return null;
    }
    
    const content = await response.text();
    const { frontmatter, content: bodyContent } = parseMarkdownFrontmatter(content);
    
    if (!frontmatter.title) {
      return null;
    }
    
    return {
      id: slug.replace('/', '-'),
      title: frontmatter.title,
      description: frontmatter.excerpt || bodyContent.substring(0, 200) + '...',
      date: frontmatter.date,
      category: frontmatter.category || '기술',
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      slug,
      content: bodyContent,
      readTime: parseInt(frontmatter.readTime) || Math.ceil(bodyContent.split(' ').length / 200)
    };
  } catch (error) {
    console.error(`Failed to load post ${slug}:`, error);
    return null;
  }
};