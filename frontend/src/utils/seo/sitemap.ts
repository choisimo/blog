import { BlogPost } from "@/types/blog";
import { getPosts } from "@/data/posts";

export interface SitemapEntry {
  url: string;
  lastModified: string;
  changeFreq:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority: number;
}

export const generateSitemap = async (): Promise<string> => {
  const baseUrl = import.meta.env.VITE_SITE_BASE_URL || "http://localhost:3000";
  const posts = await getPosts();

  const entries: SitemapEntry[] = [
    // Static pages
    {
      url: baseUrl,
      lastModified: new Date().toISOString(),
      changeFreq: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date().toISOString(),
      changeFreq: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date().toISOString(),
      changeFreq: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date().toISOString(),
      changeFreq: "monthly",
      priority: 0.6,
    },

    // Blog posts
    ...posts.map((post: BlogPost) => ({
      url: `${baseUrl}/blog/${post.year}/${post.slug}`,
      lastModified: new Date(post.date).toISOString(),
      changeFreq: "monthly" as const,
      priority: 0.8,
    })),
  ];

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastModified}</lastmod>
    <changefreq>${entry.changeFreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return xmlContent;
};

export const generateRobotsTxt = (): string => {
  const baseUrl = import.meta.env.VITE_SITE_BASE_URL || "http://localhost:3000";

  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
};

// Generate RSS feed
export const generateRSSFeed = async (): Promise<string> => {
  const baseUrl = import.meta.env.VITE_SITE_BASE_URL || "http://localhost:3000";
  const siteName = "Your Blog Name";
  const siteDescription =
    "A blog about technology, programming, and web development";
  const posts = await getPosts();

  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteName}</title>
    <description>${siteDescription}</description>
    <link>${baseUrl}</link>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <language>ko-KR</language>
    
${posts
  .slice(0, 20)
  .map(
    (post: BlogPost) => `    <item>
      <title>${post.title}</title>
      <description>${post.description}</description>
      <link>${baseUrl}/blog/${post.year}/${post.slug}</link>
      <guid isPermaLink="true">${baseUrl}/blog/${post.year}/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <category>${post.category}</category>
${post.tags.map((tag) => `      <category>${tag}</category>`).join("\n")}
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>`;

  return rssContent;
};
