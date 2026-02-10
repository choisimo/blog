import fs from 'fs';
import fse from 'fs-extra';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';

function sanitizeSegment(s) {
  return String(s || '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-/g, '')
    .replace(/-$/g, '')
    .trim();
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || 'file'));
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  if (!cleaned || cleaned.startsWith('.')) return `file-${Date.now()}`;
  return cleaned;
}

export function buildImageDir({ year, slug, subdir }) {
  const { imagesDir } = config.content;
  if (subdir) {
    const parts = String(subdir)
      .split('/')
      .map(sanitizeSegment)
      .filter(Boolean);
    const rel = parts.join('/');
    return { abs: path.join(imagesDir, rel), rel };
  }
  const y = sanitizeSegment(year);
  const s = sanitizeSegment(slug);
  if (y && /^\d{4}$/.test(y) && s) {
    const rel = path.posix.join(y, s);
    return { abs: path.join(imagesDir, rel), rel };
  }
  const now = new Date();
  const rel = path.posix.join('uploads', `${now.getFullYear()}`, `${String(now.getMonth() + 1).padStart(2, '0')}`);
  return { abs: path.join(imagesDir, rel), rel };
}

export async function saveImageWithVariants(destDirAbs, relDir, file) {
  const origName = sanitizeFilename(file.originalname || 'image');
  const ext = (origName.split('.').pop() || '').toLowerCase();
  const allowed = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg']);
  
  if (!allowed.has(ext)) {
    throw Object.assign(new Error(`Unsupported file type: .${ext}`), { status: 400 });
  }

  fse.ensureDirSync(destDirAbs);

  let finalName = origName;
  let base = origName.replace(/\.[^.]+$/, '');
  let counter = 1;
  while (fs.existsSync(path.join(destDirAbs, finalName))) {
    finalName = `${base}-${counter}.${ext}`;
    counter += 1;
  }

  const absOriginal = path.join(destDirAbs, finalName);
  await fse.writeFile(absOriginal, file.buffer);

  let webpName = null;
  let webpUrl = null;
  try {
    const img = sharp(file.buffer, { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    const maxWidth = 1600;
    const width = meta.width || maxWidth;
    const resized = width > maxWidth ? img.resize({ width: maxWidth }) : img;
    const webpBuffer = await resized.webp({ quality: 82 }).toBuffer();
    const baseName = finalName.replace(/\.[^.]+$/, '');
    webpName = `${baseName}-w${Math.min(width, maxWidth)}.webp`;
    const absWebp = path.join(destDirAbs, webpName);
    await fse.writeFile(absWebp, webpBuffer);
    webpUrl = `/images/${relDir}/${webpName}`;
  } catch (_) {
    // If sharp fails (e.g., SVG), silently skip variant
  }

  return {
    filename: finalName,
    path: `${relDir}/${finalName}`,
    url: `/images/${relDir}/${finalName}`,
    sizeBytes: file.size,
    variantWebp: webpName ? { filename: webpName, url: webpUrl } : null,
  };
}

export function listImages(dirAbs, relDir) {
  if (!fs.existsSync(dirAbs)) {
    return [];
  }
  
  const entries = fs.readdirSync(dirAbs);
  return entries
    .filter(name => fs.statSync(path.join(dirAbs, name)).isFile())
    .map(name => {
      const stat = fs.statSync(path.join(dirAbs, name));
      return {
        filename: name,
        url: `/images/${relDir}/${name}`,
        sizeBytes: stat.size,
        mtime: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => (a.filename < b.filename ? -1 : 1));
}

export async function deleteImage(year, slug, filename) {
  const y = sanitizeSegment(year);
  const s = sanitizeSegment(slug);
  const f = sanitizeFilename(filename);
  const rel = path.posix.join(y, s, f);
  const abs = path.join(config.content.imagesDir, rel);

  if (!fs.existsSync(abs)) {
    throw Object.assign(new Error('Not found'), { status: 404 });
  }
  
  await fse.unlink(abs);

  // Attempt to remove variant with -w*.webp
  const base = f.replace(/\.[^.]+$/, '');
  const variantCandidates = fs
    .readdirSync(path.dirname(abs))
    .filter(n => n.startsWith(base + '-w') && n.endsWith('.webp'));
    
  for (const cand of variantCandidates) {
    try { 
      await fse.unlink(path.join(path.dirname(abs), cand)); 
    } catch (_) {}
  }

  return { deleted: true, path: `/images/${rel}` };
}

export function generateKey(originalFilename, prefix = 'ai-chat') {
  const ext = path.extname(originalFilename || '.jpg');
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}/${timestamp}-${random}${ext}`;
}
