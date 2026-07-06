import { BlogPost } from '@/types/blog';
import { getPosts } from '@/data/content/posts';

export interface SitemapEntry {
  url: string;
  lastModified: string;
  changeFreq:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority: number;
}

const SITE_BASE_URL_FALLBACK = 'https://blog.nodove.com';
const XML_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const XML_CONTROL_TEST_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const URL_SEGMENT_CONTROL_PATTERN = /[\u0000-\u001F\u007F/\\]/;

function normalizeSiteBaseUrl(value: unknown): string {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate || XML_CONTROL_TEST_PATTERN.test(candidate)) {
    return SITE_BASE_URL_FALLBACK;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return SITE_BASE_URL_FALLBACK;
    }
    return url.href.replace(/\/$/, '');
  } catch {
    return SITE_BASE_URL_FALLBACK;
  }
}

function escapeXmlText(value: unknown): string {
  return String(value ?? '')
    .replace(XML_CONTROL_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeUrlSegment(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || URL_SEGMENT_CONTROL_PATTERN.test(trimmed)) return null;

  try {
    const decoded = decodeURIComponent(trimmed);
    if (!decoded || URL_SEGMENT_CONTROL_PATTERN.test(decoded)) return null;
    return encodeURIComponent(decoded);
  } catch {
    return null;
  }
}

function getPostUrl(baseUrl: string, post: BlogPost): string | null {
  const year = normalizeUrlSegment(post.year);
  const slug = normalizeUrlSegment(post.slug);
  return year && slug ? `${baseUrl}/blog/${year}/${slug}` : null;
}

export const generateSitemap = async (): Promise<string> => {
  const baseUrl = normalizeSiteBaseUrl(import.meta.env.VITE_SITE_BASE_URL);
  const posts = await getPosts();

  const entries: SitemapEntry[] = [
    // Static pages
    {
      url: baseUrl,
      lastModified: new Date().toISOString(),
      changeFreq: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date().toISOString(),
      changeFreq: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: new Date().toISOString(),
      changeFreq: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date().toISOString(),
      changeFreq: 'monthly',
      priority: 0.7,
    },

    // Blog posts
    ...posts.flatMap((post: BlogPost) => {
      const url = getPostUrl(baseUrl, post);
      if (!url) return [];
      return [
        {
          url,
          lastModified: new Date(post.date).toISOString(),
          changeFreq: 'monthly' as const,
          priority: 0.8,
        },
      ];
    }),
  ];

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    entry => `  <url>
    <loc>${escapeXmlText(entry.url)}</loc>
    <lastmod>${entry.lastModified}</lastmod>
    <changefreq>${entry.changeFreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return xmlContent;
};

export const generateRobotsTxt = (): string => {
  const baseUrl = normalizeSiteBaseUrl(import.meta.env.VITE_SITE_BASE_URL);

  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
};

// Generate RSS feed
export const generateRSSFeed = async (): Promise<string> => {
  const baseUrl = normalizeSiteBaseUrl(import.meta.env.VITE_SITE_BASE_URL);
  const siteName = 'Your Blog Name';
  const siteDescription =
    'A blog about technology, programming, and web development';
  const posts = await getPosts();

  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXmlText(siteName)}</title>
    <description>${escapeXmlText(siteDescription)}</description>
    <link>${escapeXmlText(baseUrl)}</link>
    <atom:link href="${escapeXmlText(`${baseUrl}/rss.xml`)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <language>ko-KR</language>
    
${posts
  .slice(0, 20)
  .flatMap((post: BlogPost) => {
    const url = getPostUrl(baseUrl, post);
    if (!url) return [];
    return [`    <item>
      <title>${escapeXmlText(post.title)}</title>
      <description>${escapeXmlText(post.description)}</description>
      <link>${escapeXmlText(url)}</link>
      <guid isPermaLink="true">${escapeXmlText(url)}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <category>${escapeXmlText(post.category)}</category>
${post.tags.map(tag => `      <category>${escapeXmlText(tag)}</category>`).join('\n')}
    </item>`];
  })
  .join('\n')}
  </channel>
</rss>`;

  return rssContent;
};
