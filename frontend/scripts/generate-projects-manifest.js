#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const projectDataDir = path.join(process.cwd(), 'public', 'project-data');
const manifestPath = path.join(process.cwd(), 'public', 'projects-manifest.json');

const VALID_TYPES = new Set(['console', 'embed', 'link']);

function walkMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      results.push(fullPath);
    }
  }

  return results;
}

function normalizeImagePath(rawPath, markdownAbsPath) {
  if (!rawPath || typeof rawPath !== 'string') return undefined;
  if (/^https?:\/\//i.test(rawPath) || rawPath.startsWith('data:')) {
    return rawPath;
  }

  if (rawPath.startsWith('/')) return rawPath;

  const markdownDir = path.dirname(markdownAbsPath);
  const absolutePath = path.resolve(markdownDir, rawPath);
  const publicDir = path.join(process.cwd(), 'public');
  const relativeToPublic = path.relative(publicDir, absolutePath);

  if (relativeToPublic && !relativeToPublic.startsWith('..')) {
    return `/${relativeToPublic.replace(/\\/g, '/')}`;
  }

  return `/${rawPath.replace(/^\.?\//, '')}`;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function toSafeDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return new Date().toISOString().slice(0, 10);
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    if (Number.isNaN(fromNumber.getTime())) return new Date().toISOString().slice(0, 10);
    return fromNumber.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string' || !value.trim()) {
    return new Date().toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function stripMarkdown(content) {
  return content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeType(value) {
  if (typeof value !== 'string') return 'link';
  const normalized = value.trim().toLowerCase();
  return VALID_TYPES.has(normalized) ? normalized : 'link';
}

function normalizeStatus(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Dev';
  return value.trim();
}

function parseProjectFile(absPath) {
  const source = fs.readFileSync(absPath, 'utf8');
  const { data: fm, content } = matter(source);
  const filename = path.basename(absPath, '.md');
  const slug = typeof fm.slug === 'string' && fm.slug.trim() ? fm.slug.trim() : filename;
  const id = typeof fm.id === 'string' && fm.id.trim() ? fm.id.trim() : slug;
  const title = typeof fm.title === 'string' && fm.title.trim()
    ? fm.title.trim()
    : slug.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  const bodyText = stripMarkdown(content);
  const description = typeof fm.description === 'string' && fm.description.trim()
    ? fm.description.trim()
    : bodyText.slice(0, 180);

  const url = typeof fm.url === 'string' && fm.url.trim()
    ? fm.url.trim()
    : typeof fm.link === 'string' && fm.link.trim()
      ? fm.link.trim()
      : '';

  if (!url) {
    console.warn(`⚠️  Skipped project (missing url): ${path.relative(process.cwd(), absPath)}`);
    return null;
  }

  const thumbnailRaw = typeof fm.thumbnail === 'string' ? fm.thumbnail : fm.coverImage;

  return {
    id,
    slug,
    title,
    description: description || 'No description provided.',
    date: toSafeDate(fm.date),
    category: typeof fm.category === 'string' && fm.category.trim() ? fm.category.trim() : 'Web',
    tags: toStringArray(fm.tags),
    stack: toStringArray(fm.stack),
    status: normalizeStatus(fm.status),
    type: normalizeType(fm.type),
    url,
    codeUrl: typeof fm.codeUrl === 'string' && fm.codeUrl.trim() ? fm.codeUrl.trim() : undefined,
    thumbnail: normalizeImagePath(thumbnailRaw, absPath),
    featured: toBoolean(fm.featured),
    published: fm.published !== false,
  };
}

function sortProjects(items) {
  return items.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

function writeManifest(items) {
  const manifest = {
    total: items.length,
    items,
    generatedAt: new Date().toISOString(),
    format: 1,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  console.log('🚀 Generating projects manifest...');

  if (!fs.existsSync(projectDataDir)) {
    fs.mkdirSync(projectDataDir, { recursive: true });
    console.log('ℹ️  Created missing directory: public/project-data');
  }

  const markdownFiles = walkMarkdownFiles(projectDataDir);

  const parsed = markdownFiles
    .map(parseProjectFile)
    .filter(item => item !== null && item.published !== false)
    .map(({ published, slug, ...rest }) => rest);

  const sortedItems = sortProjects(parsed);
  writeManifest(sortedItems);

  console.log(`✅ Wrote projects manifest: ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`   - Source markdown files: ${markdownFiles.length}`);
  console.log(`   - Published projects: ${sortedItems.length}`);
}

try {
  main();
} catch (error) {
  console.error('❌ Failed to generate projects manifest:', error);
  process.exit(1);
}
