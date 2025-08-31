import { BlogPost } from '../../types/blog';

export interface SEOData {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

export const generateSEOData = (
  post?: BlogPost,
  pageType: 'home' | 'blog' | 'post' | 'about' | 'contact' = 'home'
): SEOData => {
  const baseUrl = import.meta.env.VITE_SITE_BASE_URL || 'http://localhost:3000';
  const siteName = 'Your Blog Name'; // TODO: set your actual site name

  switch (pageType) {
    case 'post':
      if (!post) throw new Error('Post data required for post page');
      return {
        title: `${post.title} | ${siteName}`,
        description: post.description,
        keywords: [...post.tags, post.category],
        canonicalUrl: `${baseUrl}/blog/${post.year}/${post.slug}`,
        ogImage: `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}`,
        ogType: 'article',
        publishedTime: post.date,
        author: 'Your Name', // Replace with your name
        section: post.category,
        tags: post.tags,
      };

    case 'blog':
      return {
        title: `Blog | ${siteName}`,
        description:
          'Latest blog posts about technology, programming, and web development',
        keywords: ['blog', 'technology', 'programming', 'web development'],
        canonicalUrl: `${baseUrl}/blog`,
        ogImage: `${baseUrl}/og-blog.png`,
        ogType: 'website',
      };

    case 'about':
      return {
        title: `About | ${siteName}`,
        description: 'Learn more about the author and the purpose of this blog',
        keywords: ['about', 'author', 'biography'],
        canonicalUrl: `${baseUrl}/about`,
        ogImage: `${baseUrl}/og-about.png`,
        ogType: 'website',
      };

    case 'contact':
      return {
        title: `Contact | ${siteName}`,
        description: 'Get in touch with the blog author',
        keywords: ['contact', 'email', 'reach out'],
        canonicalUrl: `${baseUrl}/contact`,
        ogImage: `${baseUrl}/og-contact.png`,
        ogType: 'website',
      };

    default:
      return {
        title: siteName,
        description:
          'A blog about technology, programming, and web development',
        keywords: [
          'blog',
          'technology',
          'programming',
          'web development',
          'tutorials',
        ],
        canonicalUrl: baseUrl,
        ogImage: `${baseUrl}/og-home.png`,
        ogType: 'website',
      };
  }
};

export const generateStructuredData = (
  post?: BlogPost,
  pageType: string = 'home'
) => {
  const baseUrl = import.meta.env.VITE_SITE_BASE_URL || 'http://localhost:3000';
  const siteName = 'Your Blog Name'; // TODO: set your actual site name
  const authorName = 'Your Name'; // TODO: set your actual name

  if (pageType === 'post' && post) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      image: `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}`,
      author: {
        '@type': 'Person',
        name: authorName,
      },
      publisher: {
        '@type': 'Organization',
        name: siteName,
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/logo.png`,
        },
      },
      datePublished: post.date,
      dateModified: post.date,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${baseUrl}/blog/${post.year}/${post.slug}`,
      },
      keywords: post.tags.join(', '),
      articleSection: post.category,
    };
  }

  if (pageType === 'blog') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${siteName} Blog`,
      description: 'A blog about technology, programming, and web development',
      url: `${baseUrl}/blog`,
      author: {
        '@type': 'Person',
        name: authorName,
      },
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    description: 'A blog about technology, programming, and web development',
    url: baseUrl,
    author: {
      '@type': 'Person',
      name: authorName,
    },
  };
};
