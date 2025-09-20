import { Router } from 'express';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'node:path';
import matter from 'gray-matter';
import slugify from 'slugify';
import { config } from '../config.js';
import requireAdmin from '../middleware/adminAuth.js';
import { buildFrontmatterMarkdown } from '../lib/markdown.js';

const router = Router();


function validateFilename(filename) {
  const validFilenamePattern = /^[a-zA-Z0-9][a-zA-Z0-9\-_]*\.md$/;
  return validFilenamePattern.test(filename);
}


function computeItem(year, file, fm, body) {
  const filename = path.basename(file, '.md');
  const slug = fm.slug || filename;
  const date = fm.date || `${year}-01-01`;
  const tags = Array.isArray(fm.tags) ? fm.tags : [];
  const category = fm.category || 'General';
  const author = fm.author || 'Admin';
  const published = fm.published !== false;
  const coverImage = fm.coverImage || fm.cover || undefined;

  const textOnly = String(body)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
  const snippet = (fm.description || fm.excerpt || textOnly).slice(0, 200).trim();
  const words = textOnly.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  const readingTime = `${minutes} min read`;

  return {
    path: `/posts/${year}/${file}`,
    year,
    slug,
    title: fm.title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: fm.description || snippet,
    snippet,
    date,
    tags,
    category,
    author,
    readingTime,
    published,
    coverImage,
    url: `/blog/${year}/${slug}`,
  };
}

function listYears(postsDir) {
  return fs
    .readdirSync(postsDir)
    .filter(item => fs.statSync(path.join(postsDir, item)).isDirectory())
    .filter(year => /^\d{4}$/.test(year));
}

function generatePerYearManifest(year) {
  const { postsDir } = config.content;
  const yearDir = path.join(postsDir, year);
  if (!fs.existsSync(yearDir)) return { valid: 0, invalid: 0 };
  const files = fs.readdirSync(yearDir).filter(f => f.endsWith('.md'));
  const valid = [];
  const invalid = [];
  for (const file of files) {
    if (!validateFilename(file)) {
      invalid.push(file);
      continue;
    }
    const abs = path.join(yearDir, file);
    try {
      const raw = fs.readFileSync(abs, 'utf8');
      if (!raw.trim()) {
        invalid.push(file);
        continue;
      }
      // frontmatter presence is recommended but not required
      valid.push(file);
    } catch {
      invalid.push(file);
    }
  }
  const manifest = {
    files: valid.sort(),
    generatedAt: new Date().toISOString(),
    totalFiles: valid.length,
    excludedFiles: invalid.length,
  };
  fs.writeFileSync(path.join(yearDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { valid: valid.length, invalid: invalid.length };
}

function generateUnifiedManifest() {
  const { postsDir, publicDir } = config.content;
  const years = listYears(postsDir);
  const items = [];
  for (const year of years) {
    const yearDir = path.join(postsDir, year);
    const files = fs.readdirSync(yearDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      if (!validateFilename(file)) continue;
      const abs = path.join(yearDir, file);
      try {
        const raw = fs.readFileSync(abs, 'utf8');
        if (!raw.trim()) continue;
        const { data: fm, content } = matter(raw);
        const item = computeItem(year, file, fm, content);
        items.push(item);
      } catch {}
    }
  }
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const unified = {
    total: items.length,
    items,
    generatedAt: new Date().toISOString(),
    years: years.sort().reverse(),
    format: 2,
  };
  const rootPath = path.join(publicDir, 'posts-manifest.json');
  const nestedPath = path.join(publicDir, 'posts', 'posts-manifest.json');
  fse.ensureDirSync(path.dirname(nestedPath));
  const payload = `${JSON.stringify(unified, null, 2)}\n`;
  fs.writeFileSync(rootPath, payload);
  fs.writeFileSync(nestedPath, payload);
  return unified;
}

router.get('/', async (req, res, next) => {
  try {
    const { postsDir } = config.content;
    const years = listYears(postsDir);
    const q = req.query || {};
    const year = (q.year || '').toString();
    const includeDrafts = String(q.includeDrafts || 'false') === 'true';

    let items = [];
    const yearsToScan = year && /^\d{4}$/.test(year) ? [year] : years;
    for (const y of yearsToScan) {
      const dir = path.join(postsDir, y);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
        if (!validateFilename(file)) continue;
        const abs = path.join(dir, file);
        const raw = fs.readFileSync(abs, 'utf8');
        const { data: fm, content } = matter(raw);
        if (fm.published === false && !includeDrafts) continue;
        items.push(computeItem(y, file, fm, content));
      }
    }

    // basic sort by date desc
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return res.json({ ok: true, data: { items } });
  } catch (err) {
    return next(err);
  }
});

router.get('/:year/:slug', async (req, res, next) => {
  try {
    const { year, slug } = req.params;
    if (!/^\d{4}$/.test(year))
      return res.status(400).json({ ok: false, error: 'Invalid year' });

    const file = `${slug}.md`;
    const abs = path.join(config.content.postsDir, year, file);
    if (!fs.existsSync(abs))
      return res.status(404).json({ ok: false, error: 'Not found' });
    const raw = fs.readFileSync(abs, 'utf8');
    const { data: fm, content } = matter(raw);
    const item = computeItem(year, file, fm, content);
    return res.json({ ok: true, data: { item, markdown: raw } });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { title, slug: slugRaw, year: yearRaw, content, frontmatter } = req.body || {};
    const year = String(yearRaw || new Date().getFullYear());
    if (!/^\d{4}$/.test(year))
      return res.status(400).json({ ok: false, error: 'year must be YYYY' });

    let slug = String(slugRaw || title || 'post');
    slug = slugify(slug, { lower: true, strict: true });
    const filename = `${slug}.md`;
    if (!validateFilename(filename))
      return res.status(400).json({ ok: false, error: 'invalid slug/filename' });

    const yearDir = path.join(config.content.postsDir, year);
    fse.ensureDirSync(yearDir);
    const abs = path.join(yearDir, filename);
    if (fs.existsSync(abs))
      return res.status(409).json({ ok: false, error: 'already exists' });

    const fm = {
      title: title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      date: new Date().toISOString(),
      tags: [],
      category: 'General',
      published: true,
      ...(frontmatter && typeof frontmatter === 'object' ? frontmatter : {}),
    };
    const body = typeof content === 'string' ? content : '';
    const md = buildFrontmatterMarkdown(fm, body);

    fs.writeFileSync(abs, md);

    // regenerate manifests
    generatePerYearManifest(year);
    const unified = generateUnifiedManifest();

    return res.status(201).json({ ok: true, data: { path: `/posts/${year}/${filename}`, manifestTotal: unified.total } });
  } catch (err) {
    return next(err);
  }
});

router.put('/:year/:slug', requireAdmin, async (req, res, next) => {
  try {
    const { year, slug } = req.params;
    if (!/^\d{4}$/.test(year))
      return res.status(400).json({ ok: false, error: 'Invalid year' });
    const filename = `${slug}.md`;
    const abs = path.join(config.content.postsDir, year, filename);
    if (!fs.existsSync(abs))
      return res.status(404).json({ ok: false, error: 'Not found' });

    const { markdown, frontmatter, content } = req.body || {};
    let newMd;
    if (typeof markdown === 'string') {
      newMd = markdown;
    } else {
      // if fm/content provided, rebuild
      const existing = fs.readFileSync(abs, 'utf8');
      const { data: fm0 } = matter(existing);
      const fm = { ...fm0, ...(frontmatter && typeof frontmatter === 'object' ? frontmatter : {}) };
      const body = typeof content === 'string' ? content : existing.replace(/^---[\s\S]*?---\n?/, '');
      newMd = buildFrontmatterMarkdown(fm, body);
    }

    fs.writeFileSync(abs, newMd);
    generatePerYearManifest(year);
    const unified = generateUnifiedManifest();

    return res.json({ ok: true, data: { updated: true, manifestTotal: unified.total } });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:year/:slug', requireAdmin, async (req, res, next) => {
  try {
    const { year, slug } = req.params;
    if (!/^\d{4}$/.test(year))
      return res.status(400).json({ ok: false, error: 'Invalid year' });
    const filename = `${slug}.md`;
    const abs = path.join(config.content.postsDir, year, filename);
    if (!fs.existsSync(abs))
      return res.status(404).json({ ok: false, error: 'Not found' });

    fs.unlinkSync(abs);
    // If year dir becomes empty, keep dir (front-end expects /posts/<year>/)

    generatePerYearManifest(year);
    const unified = generateUnifiedManifest();

    return res.json({ ok: true, data: { deleted: true, manifestTotal: unified.total } });
  } catch (err) {
    return next(err);
  }
});

router.post('/regenerate-manifests', requireAdmin, async (req, res, next) => {
  try {
    const years = listYears(config.content.postsDir);
    for (const y of years) generatePerYearManifest(y);
    const unified = generateUnifiedManifest();
    return res.json({ ok: true, data: { total: unified.total, years: unified.years } });
  } catch (err) {
    return next(err);
  }
});

export default router;
