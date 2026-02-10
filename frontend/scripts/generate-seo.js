#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const MANIFEST_ROOT_PATH = path.join(PUBLIC_DIR, 'posts-manifest.json');
const MANIFEST_NESTED_PATH = path.join(
  PUBLIC_DIR,
  'posts',
  'posts-manifest.json'
);

import dotenv from 'dotenv';
// Load root .env if present, then frontend/.env override
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env'), override: true });
const BASE_URL =
  process.env.SITE_BASE_URL ||
  process.env.VITE_SITE_BASE_URL ||
  'http://localhost:3000';
const SITE_NAME = 'Nodove Blog';
const SITE_DESCRIPTION =
  'A blog about technology, programming, and web development';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadManifest() {
  let manifestPath = MANIFEST_ROOT_PATH;
  if (!fs.existsSync(manifestPath) && fs.existsSync(MANIFEST_NESTED_PATH)) {
    manifestPath = MANIFEST_NESTED_PATH;
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `posts-manifest.json not found at ${MANIFEST_ROOT_PATH} or ${MANIFEST_NESTED_PATH}. Run npm run generate-manifests first.`
    );
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed;
}

function parsePost(filePath, manifestPath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { data: frontMatter, content: body } = matter(content);

  const rel = manifestPath.replace(/^\//, ''); // remove leading slash
  const parts = rel.split('/'); // [ 'posts', '2025', 'my-post.md' ]
  const year = parts[1] || String(new Date().getFullYear());
  const filename = parts[2] || path.basename(filePath);
  const slugFromFile = filename.replace(/\.md$/i, '');

  const slug = frontMatter.slug || slugFromFile;
  const title =
    frontMatter.title ||
    slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const description =
    frontMatter.description || `${body.trim().slice(0, 160)}...`;
  const date = frontMatter.date || `${year}-01-01`;
  const tags = Array.isArray(frontMatter.tags) ? frontMatter.tags : [];
  const category = frontMatter.category || 'General';
  const published = frontMatter.published !== false;

  return {
    title,
    description,
    date,
    tags,
    category,
    slug,
    year,
    published,
  };
}

function loadPosts() {
  const manifest = loadManifest();
  const posts = [];

  if (Array.isArray(manifest.items)) {
    for (const item of manifest.items) {
      // Skip unpublished
      if (item && item.published === false) continue;
      const rel = (item.path || '').replace(/^\//, '');
      const abs = path.join(PUBLIC_DIR, rel);
      if (!fs.existsSync(abs)) {
        console.warn(`Skipping missing post file: ${abs}`);
        continue;
      }
      // Prefer manifest metadata to preserve custom slug and fields
      const year = String(item.year || '');
      const slug = String(item.slug || '');
      const title =
        item.title ||
        slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const description = item.description || item.snippet || '';
      const date =
        item.date || (year ? `${year}-01-01` : new Date().toISOString());
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const category = item.category || 'General';
      const published = item.published !== false;

      posts.push({
        title,
        description,
        date,
        tags,
        category,
        slug,
        year,
        published,
      });
    }
  } else if (Array.isArray(manifest.posts)) {
    for (const manifestPath of manifest.posts) {
      const rel = manifestPath.replace(/^\//, '');
      const abs = path.join(PUBLIC_DIR, rel);
      if (!fs.existsSync(abs)) {
        console.warn(`Skipping missing post file: ${abs}`);
        continue;
      }
      const post = parsePost(abs, manifestPath);
      if (post.published) posts.push(post);
    }
  } else {
    console.warn(
      "posts-manifest.json has an unknown structure. Expected 'items' (format:2) or 'posts' (legacy)."
    );
  }

  // sort by date desc
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return posts;
}

function generateSitemap(posts) {
  const entries = [
    {
      url: BASE_URL,
      changefreq: 'weekly',
      priority: 1.0,
      lastmod: new Date().toISOString(),
    },
    {
      url: `${BASE_URL}/blog`,
      changefreq: 'daily',
      priority: 0.9,
      lastmod: new Date().toISOString(),
    },
    {
      url: `${BASE_URL}/projects`,
      changefreq: 'weekly',
      priority: 0.85,
      lastmod: new Date().toISOString(),
    },
    {
      url: `${BASE_URL}/about`,
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: new Date().toISOString(),
    },
    ...posts.map(p => ({
      url: `${BASE_URL}/blog/${p.year}/${p.slug}`,
      changefreq: 'monthly',
      priority: 0.8,
      lastmod: new Date(p.date).toISOString(),
    })),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
      .map(
        e =>
          `  <url>\n    <loc>${e.url}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
      )
      .join('\n')}\n</urlset>\n`;
  return xml;
}

function buildRobotsWithSitemap(existing = '') {
  const sitemapLine = `Sitemap: ${BASE_URL}/sitemap.xml`;
  if (existing.includes('Sitemap:')) {
    // If a Sitemap line exists but not our exact URL, append our URL too.
    if (!existing.includes(sitemapLine)) {
      const end = existing.endsWith('\n') ? '' : '\n';
      return `${existing + end + sitemapLine}\n`;
    }
    return existing;
  }
  if (existing.trim().length > 0) {
    const end = existing.endsWith('\n') ? '' : '\n';
    return `${existing + end + sitemapLine}\n`;
  }
  // Default robots if none exists
  return `User-agent: *\nAllow: /\n\n${sitemapLine}\n`;
}

function escapeXml(input) {
  const str = String(input ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateRSS(posts) {
  const items = posts
    .slice(0, 20)
    .map(p => {
      const tags = Array.isArray(p.tags) ? p.tags : [];
      const tagLines = tags
        .filter(t => t)
        .map(t => `      <category>${escapeXml(t)}</category>`)
        .join('\n');
      return (
        `    <item>\n` +
        `      <title>${escapeXml(p.title)}</title>\n` +
        `      <description>${escapeXml(p.description)}</description>\n` +
        `      <link>${BASE_URL}/blog/${p.year}/${p.slug}</link>\n` +
        `      <guid isPermaLink="true">${BASE_URL}/blog/${p.year}/${p.slug}</guid>\n` +
        `      <pubDate>${new Date(p.date).toUTCString()}</pubDate>\n` +
        `      <category>${escapeXml(p.category)}</category>\n` +
        `${tagLines ? tagLines + '\n' : ''}    </item>`
      );
    })
    .join('\n');

  const rss =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>${escapeXml(SITE_NAME)}</title>\n` +
    `    <description>${escapeXml(SITE_DESCRIPTION)}</description>\n` +
    `    <link>${BASE_URL}</link>\n` +
    `    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>\n` +
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n` +
    `    <language>en-US</language>\n${items}\n  </channel>\n` +
    `</rss>\n`;
  return rss;
}

function writeFileSafe(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
  console.log(
    `✔ Wrote ${path.relative(PROJECT_ROOT, filePath)} (${Buffer.byteLength(content)} bytes)`
  );
}

function main() {
  console.log('🧭 Generating SEO files (sitemap.xml, robots.txt, rss.xml)...');
  const posts = loadPosts();
  const sitemap = generateSitemap(posts);
  // Preserve existing robots.txt if present, ensure sitemap line exists
  const robotsPath = path.join(PUBLIC_DIR, 'robots.txt');
  const existingRobots = fs.existsSync(robotsPath)
    ? fs.readFileSync(robotsPath, 'utf8')
    : '';
  const robots = buildRobotsWithSitemap(existingRobots);
  const rss = generateRSS(posts);

  writeFileSafe(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemap);
  writeFileSafe(robotsPath, robots);
  writeFileSafe(path.join(PUBLIC_DIR, 'rss.xml'), rss);

  console.log('✨ SEO files generated successfully');
}

try {
  main();
} catch (err) {
  console.error('Failed to generate SEO files:', err);
  process.exit(1);
}
