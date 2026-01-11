#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = process.cwd();
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const MANIFEST_ROOT_PATH = path.join(PUBLIC_DIR, 'posts-manifest.json');
const MANIFEST_NESTED_PATH = path.join(PUBLIC_DIR, 'posts', 'posts-manifest.json');

const repoRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, 'frontend', '.env'), override: true });

const BASE_URL = process.env.SITE_BASE_URL || process.env.VITE_SITE_BASE_URL || 'https://noblog.nodove.com';
const SITE_NAME = 'Nodove Blog';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveImageUrl(coverImage) {
  if (!coverImage) return `${BASE_URL}/og-default.png`;
  if (coverImage.startsWith('http')) return coverImage;
  return `${BASE_URL}${coverImage.startsWith('/') ? '' : '/'}${coverImage}`;
}

function generatePostHtml(template, post) {
  const title = escapeHtml(post.title);
  const description = escapeHtml(post.description || post.snippet || '');
  const url = `${BASE_URL}/blog/${post.year}/${post.slug}`;
  const image = resolveImageUrl(post.coverImage);
  const category = escapeHtml(post.category || 'Blog');
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
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
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
`;

  const existingOgPattern = /<meta\s+property="og:[^"]+"\s+content="[^"]*"\s*\/?>/gi;
  const existingTwitterPattern = /<meta\s+name="twitter:[^"]+"\s+content="[^"]*"\s*\/?>/gi;
  html = html.replace(existingOgPattern, '');
  html = html.replace(existingTwitterPattern, '');

  html = html.replace('</head>', `${ogTags}</head>`);

  return html;
}

function generateStaticPages(template) {
  const pages = [
    { path: 'blog', title: 'Blog', description: '기술, 개발, 생각에 대한 글들' },
    { path: 'about', title: 'About', description: 'Nodove 소개' },
    { path: 'stack', title: 'Tech Stack', description: '사용하는 기술 스택' },
  ];

  let count = 0;

  for (const page of pages) {
    const pageDir = path.join(DIST_DIR, page.path);
    ensureDir(pageDir);

    let html = template;
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${page.title} | ${SITE_NAME}</title>`);

    const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${BASE_URL}/${page.path}" />
    <meta property="og:title" content="${page.title} | ${SITE_NAME}" />
    <meta property="og:description" content="${page.description}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta name="twitter:card" content="summary" />
    <link rel="canonical" href="${BASE_URL}/${page.path}" />
`;

    html = html.replace('</head>', `${ogTags}</head>`);
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

  const template = fs.readFileSync(templatePath, 'utf8');
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
