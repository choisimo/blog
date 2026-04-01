#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { resolveSiteBaseUrl } from './lib/resolve-site-url.js';

const PROJECT_ROOT = process.cwd();
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const MANIFEST_ROOT_PATH = path.join(PUBLIC_DIR, 'posts-manifest.json');
const MANIFEST_NESTED_PATH = path.join(PUBLIC_DIR, 'posts', 'posts-manifest.json');

const BASE_URL = resolveSiteBaseUrl();
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://api.nodove.com';
const SITE_NAME = 'Nodove Blog';
const THEME_DEFAULT = 'terminal';
const THEME_DEFAULT_META_TAG = `<meta name="theme-default" content="${THEME_DEFAULT}" />`;
const THEME_DEFAULT_META_PATTERN = /<meta\s+name="theme-default"\s+content="[^"]*"\s*\/?>/i;
const LEGACY_THEME_DEFAULT_EXPRESSION = `(document.querySelector('meta[name="theme-default"]') || {}).content || "terminal"`;
const CANONICAL_THEME_DEFAULT_EXPRESSION = `document.querySelector('meta[name="theme-default"]')?.content ?? '${THEME_DEFAULT}'`;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function applyThemeContract(template) {
  let html = template;

  if (THEME_DEFAULT_META_PATTERN.test(html)) {
    html = html.replace(THEME_DEFAULT_META_PATTERN, THEME_DEFAULT_META_TAG);
  } else {
    html = html.replace('</head>', `  ${THEME_DEFAULT_META_TAG}\n</head>`);
  }

  return html.replace(LEGACY_THEME_DEFAULT_EXPRESSION, CANONICAL_THEME_DEFAULT_EXPRESSION);
}

function loadManifest() {
  let manifestPath = MANIFEST_ROOT_PATH;
  if (!fs.existsSync(manifestPath) && fs.existsSync(MANIFEST_NESTED_PATH)) {
    manifestPath = MANIFEST_NESTED_PATH;
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`posts-manifest.json not found. Run 'npm run generate-manifests' first.`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function escapeHtml(str) {
  if (str == null) return '';
  if (Array.isArray(str)) return str.map(s => escapeHtml(s)).join(', ');
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveImageUrl(coverImage, title, category) {
  if (coverImage) {
    if (coverImage.startsWith('http')) return coverImage;
    return `${BASE_URL}${coverImage.startsWith('/') ? '' : '/'}${coverImage}`;
  }
  const params = new URLSearchParams({
    title: title || 'Blog Post',
    subtitle: category || '',
  });
  return `${API_BASE_URL}/api/v1/og?${params.toString()}`;
}

function generateStructuredDataStr(pageType, data = {}) {
  const authorName = process.env.VITE_AUTHOR_NAME || 'nodove';

  if (pageType === 'post' && data) {
    const sd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: data.title,
      description: data.description,
      image: resolveImageUrl(data.coverImage, data.title, data.category),
      author: {
        '@type': 'Person',
        name: authorName,
      },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        logo: {
          '@type': 'ImageObject',
          url: `${BASE_URL}/nodove.ico`,
        },
      },
      datePublished: data.date,
      dateModified: data.date,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${BASE_URL}/blog/${data.year}/${data.slug}`,
      },
      keywords: Array.isArray(data.tags) ? data.tags.join(', ') : '',
      articleSection: data.category,
    };
    return `<script type="application/ld+json">${JSON.stringify(sd)}</script>`;
  }

  if (pageType === 'blog') {
    const sd = {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${SITE_NAME} Blog`,
      description: 'A blog about technology, programming, and web development',
      url: `${BASE_URL}/blog`,
      author: {
        '@type': 'Person',
        name: authorName,
      },
    };
    return `<script type="application/ld+json">${JSON.stringify(sd)}</script>`;
  }

  const sd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: 'A blog about technology, programming, and web development',
    url: BASE_URL,
    author: {
      '@type': 'Person',
      name: authorName,
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(sd)}</script>`;
}

function generatePostHtml(template, post) {
  const title = escapeHtml(post.title);
  const description = escapeHtml(post.description || post.snippet || '');
  const url = `${BASE_URL}/blog/${post.year}/${post.slug}`;
  const category = escapeHtml(post.category || 'Blog');
  const image = resolveImageUrl(post.coverImage, post.title, post.category);
  const date = post.date || new Date().toISOString();
  const author = escapeHtml(post.author || 'Admin');
  const tags = Array.isArray(post.tags) ? post.tags.map(t => escapeHtml(t)).join(', ') : '';

  let html = template;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title} | ${SITE_NAME}</title>`);

  const existingDescMeta = /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i;
  if (existingDescMeta.test(html)) {
    html = html.replace(existingDescMeta, `<meta name="description" content="${description}" />`);
  }

  const ogTags = `
    <!-- Open Graph / Facebook / KakaoTalk -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="article:published_time" content="${date}" />
    <meta property="article:author" content="${author}" />
    <meta property="article:section" content="${category}" />
    ${tags ? `<meta property="article:tag" content="${tags}" />` : ''}
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${url}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    
    <!-- Additional SEO -->
    <link rel="canonical" href="${url}" />
    ${generateStructuredDataStr('post', post)}
`;

  const existingOgPattern = /<meta\s+property="og:[^"]+"\s+content="[^"]*"\s*\/?>/gi;
  const existingTwitterPattern = /<meta\s+name="twitter:[^"]+"\s+content="[^"]*"\s*\/?>/gi;
  html = html.replace(existingOgPattern, '');
  html = html.replace(existingTwitterPattern, '');

  html = html.replace('</head>', `${ogTags}\n</head>`);

  return html;
}

function generateStaticPages(template) {
  const pages = [
    { path: 'blog', title: 'Blog', description: '기술, 개발, 생각에 대한 글들' },
    { path: 'projects', title: 'Projects', description: '프로젝트 허브와 AI Console 미리보기' },
    { path: 'about', title: 'About', description: 'Nodove 소개' },
  ];

  let count = 0;

  for (const page of pages) {
    const pageDir = path.join(DIST_DIR, page.path);
    ensureDir(pageDir);

    const pageImage = `${API_BASE_URL}/api/v1/og?title=${encodeURIComponent(page.title)}&subtitle=${encodeURIComponent(SITE_NAME)}`;

    let html = template;
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${page.title} | ${SITE_NAME}</title>`);

    const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${BASE_URL}/${page.path}" />
    <meta property="og:title" content="${page.title} | ${SITE_NAME}" />
    <meta property="og:description" content="${page.description}" />
    <meta property="og:image" content="${pageImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="ko_KR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${page.title} | ${SITE_NAME}" />
    <meta name="twitter:description" content="${page.description}" />
    <meta name="twitter:image" content="${pageImage}" />
    <link rel="canonical" href="${BASE_URL}/${page.path}" />
    ${generateStructuredDataStr(page.path === 'blog' ? 'blog' : 'home')}
`;

    html = html.replace('</head>', `${ogTags}\n</head>`);
    fs.writeFileSync(path.join(pageDir, 'index.html'), html);
    count++;
  }

  return count;
}

function main() {
  console.log('🚀 Static HTML Generation Started...');
  console.log(`   Base URL: ${BASE_URL}`);

  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const templatePath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(templatePath)) {
    console.error('❌ dist/index.html not found. Run "npm run build" first.');
    process.exit(1);
  }

  const template = applyThemeContract(fs.readFileSync(templatePath, 'utf8'));
  const manifest = loadManifest();

  if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
    console.warn('⚠️  No posts found in manifest');
    return;
  }

  let postCount = 0;

  for (const post of manifest.items) {
    if (post.published === false) continue;

    const postDir = path.join(DIST_DIR, 'blog', post.year, post.slug);
    ensureDir(postDir);

    const html = generatePostHtml(template, post);
    fs.writeFileSync(path.join(postDir, 'index.html'), html);
    postCount++;
  }

  const staticCount = generateStaticPages(template);

  console.log(`✨ Generated ${postCount} post HTML files`);
  console.log(`✨ Generated ${staticCount} static page HTML files`);
  console.log('✅ Static HTML generation complete!');
}

try {
  main();
} catch (err) {
  console.error('❌ Failed to generate static HTML:', err);
  process.exit(1);
}
