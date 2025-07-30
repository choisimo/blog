import { BlogPost } from '@/types/blog';

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

function createSlug(filename: string): string {
  return filename.replace(/\.md$/, '');
}

async function loadMarkdownPosts(): Promise<BlogPost[]> {
  const posts: BlogPost[] = [];
  
  try {
    // Load 2025 posts
    const manifest2025Response = await fetch(`/posts/2025/manifest.json`);
    if (manifest2025Response.ok) {
      const manifest2025 = await manifest2025Response.json();
      
      for (const filename of manifest2025.files) {
        if (filename.endsWith('.md')) {
          try {
            const response = await fetch(`/posts/2025/${filename}`);
            if (response.ok) {
              const content = await response.text();
              const { frontmatter, content: bodyContent } = parseMarkdownFrontmatter(content);
              
              if (frontmatter.title) {
                posts.push({
                  id: `2025-${createSlug(filename)}`,
                  title: frontmatter.title,
                  description: frontmatter.excerpt || bodyContent.substring(0, 200) + '...',
                  date: frontmatter.date,
                  category: frontmatter.category || '기술',
                  tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
                  slug: `2025/${createSlug(filename)}`,
                  content: bodyContent,
                  readTime: parseInt(frontmatter.readTime) || Math.ceil(bodyContent.split(' ').length / 200)
                });
              }
            }
          } catch (error) {
            console.warn(`Failed to load ${filename}:`, error);
          }
        }
      }
    }
    
    // Load 2024 posts
    const manifest2024Response = await fetch(`/posts/2024/manifest.json`);
    if (manifest2024Response.ok) {
      const manifest2024 = await manifest2024Response.json();
      
      for (const filename of manifest2024.files) {
        if (filename.endsWith('.md')) {
          try {
            const response = await fetch(`/posts/2024/${filename}`);
            if (response.ok) {
              const content = await response.text();
              const { frontmatter, content: bodyContent } = parseMarkdownFrontmatter(content);
              
              if (frontmatter.title) {
                posts.push({
                  id: `2024-${createSlug(filename)}`,
                  title: frontmatter.title,
                  description: frontmatter.excerpt || bodyContent.substring(0, 200) + '...',
                  date: frontmatter.date,
                  category: frontmatter.category || '기술',
                  tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
                  slug: `2024/${createSlug(filename)}`,
                  content: bodyContent,
                  readTime: parseInt(frontmatter.readTime) || Math.ceil(bodyContent.split(' ').length / 200)
                });
              }
            }
          } catch (error) {
            console.warn(`Failed to load ${filename}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to load posts:', error);
  }
  
  // Sort posts by date (newest first)
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Initialize posts
let posts: BlogPost[] = [];
let postsLoaded = false;

// Load posts immediately
const initializePosts = async () => {
  if (!postsLoaded) {
    posts = await loadMarkdownPosts();
    postsLoaded = true;
  }
};

// Start loading posts
initializePosts();

export { posts };

// Export a function to get posts with loading check
export const getPosts = async (): Promise<BlogPost[]> => {
  if (!postsLoaded) {
    await initializePosts();
  }
  return posts;
};

export const getPostBySlug = (slug: string): BlogPost | undefined => {
  return posts.find(post => post.slug === slug);
};

export const getPostsByCategory = (category: string): BlogPost[] => {
  return posts.filter(post => post.category.toLowerCase() === category.toLowerCase());
};

export const getPostsByTag = (tag: string): BlogPost[] => {
  return posts.filter(post => 
    post.tags.some(t => t.toLowerCase() === tag.toLowerCase())
  );
};

export const getAllCategories = (): string[] => {
  const categories = new Set(posts.map(post => post.category));
  return Array.from(categories);
};

export const getAllTags = (): string[] => {
  const tags = new Set(posts.flatMap(post => post.tags));
  return Array.from(tags);
};