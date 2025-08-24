import { BlogPost } from '@/types/blog';

function parseMarkdownFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  content: string;
} {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content };
  }

  const frontmatterText = match[1];
  const bodyContent = match[2];

  const frontmatter: Record<string, unknown> = {};
  frontmatterText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
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

async function loadPostsFromYear(year: string): Promise<BlogPost[]> {
  const posts: BlogPost[] = [];

  try {
    console.log(`Fetching ${year} manifest...`);
    const manifestResponse = await fetch(`/posts/${year}/manifest.json`);

    if (!manifestResponse.ok) {
      console.warn(
        `Failed to fetch ${year} manifest:`,
        manifestResponse.status
      );
      return posts;
    }

    const manifest = await manifestResponse.json();
    const markdownFiles = manifest.files.filter((file: string) =>
      file.endsWith('.md')
    );

    console.log(`Loading ${markdownFiles.length} posts from ${year}...`);

    // Load all posts in parallel
    const postPromises = markdownFiles.map(async (filename: string) => {
      try {
        const response = await fetch(`/posts/${year}/${filename}`);

        if (!response.ok) {
          console.warn(`Failed to load ${year}/${filename}:`, response.status);
          return null;
        }

        const content = await response.text();
        const { frontmatter, content: bodyContent } =
          parseMarkdownFrontmatter(content);

        if (!frontmatter.title) {
          console.warn(`No title found in ${filename}`);
          return null;
        }

        return {
          id: `${year}-${createSlug(filename)}`,
          title: frontmatter.title,
          description:
            frontmatter.excerpt || `${bodyContent.substring(0, 200)}...`,
          date: frontmatter.date,
          year,
          category: frontmatter.category || '기술',
          tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
          slug: `${year}/${createSlug(filename)}`,
          content: bodyContent,
          readTime:
            typeof frontmatter.readTime === 'string'
              ? parseInt(frontmatter.readTime, 10)
              : typeof frontmatter.readTime === 'number'
                ? frontmatter.readTime
                : Math.ceil(bodyContent.split(' ').length / 200),
        };
      } catch (error) {
        console.warn(`Failed to load ${filename}:`, error);
        return null;
      }
    });

    const results = await Promise.all(postPromises);
    const validPosts = results.filter(
      (post): post is BlogPost => post !== null
    );

    console.log(
      `Successfully loaded ${validPosts.length}/${markdownFiles.length} posts from ${year}`
    );
    return validPosts;
  } catch (error) {
    console.error(`Failed to load posts from ${year}:`, error);
    return posts;
  }
}

async function loadMarkdownPosts(): Promise<BlogPost[]> {
  try {
    console.log('Loading posts from all years...');

    // Load posts from both years in parallel
    const [posts2025, posts2024] = await Promise.all([
      loadPostsFromYear('2025'),
      loadPostsFromYear('2024'),
    ]);

    const allPosts = [...posts2025, ...posts2024];
    console.log(`Total posts loaded: ${allPosts.length}`);

    // Sort posts by date (newest first)
    return allPosts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch (error) {
    console.error('Failed to load posts:', error);
    return [];
  }
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
  return posts.filter(
    post => post.category.toLowerCase() === category.toLowerCase()
  );
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
