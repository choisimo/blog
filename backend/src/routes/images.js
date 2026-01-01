import { Router } from 'express';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { config } from '../config.js';
import requireAdmin from '../middleware/adminAuth.js';
import { upload as r2Upload, isR2Configured, generateKey } from '../lib/r2.js';
import { getN8NClient } from '../lib/n8n-client.js';

const router = Router();


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
});

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
  // Disallow hidden files and traversal
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  if (!cleaned || cleaned.startsWith('.')) return `file-${Date.now()}`;
  return cleaned;
}

function buildDir({ year, slug, subdir }) {
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

async function saveWithVariants(destDirAbs, relDir, file) {
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

router.post('/upload', requireAdmin, upload.array('files', 10), async (req, res, next) => {
  try {
    const b = req.body || {};
    const { year, slug, subdir } = b;
    const { abs, rel } = buildDir({ year, slug, subdir });

    const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);
    if (!files.length) return res.status(400).json({ ok: false, error: 'No files uploaded (use field "files")' });

    const results = [];
    for (const file of files) {
      const item = await saveWithVariants(abs, rel, file);
      results.push(item);
    }

    return res.status(201).json({ ok: true, data: { dir: `/images/${rel}`, items: results } });
  } catch (err) {
    return next(err);
  }
});

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const q = req.query || {};
    const { year, slug, dir: subdir } = q;
    const { abs, rel } = buildDir({ year, slug, subdir });

    if (!fs.existsSync(abs)) return res.json({ ok: true, data: { dir: `/images/${rel}`, items: [] } });
    const entries = fs.readdirSync(abs);
    const items = entries
      .filter(name => fs.statSync(path.join(abs, name)).isFile())
      .map(name => {
        const stat = fs.statSync(path.join(abs, name));
        return {
          filename: name,
          url: `/images/${rel}/${name}`,
          sizeBytes: stat.size,
          mtime: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => (a.filename < b.filename ? -1 : 1));

    return res.json({ ok: true, data: { dir: `/images/${rel}`, items } });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:year/:slug/:filename', requireAdmin, async (req, res, next) => {
  try {
    const { year, slug, filename } = req.params || {};
    if (!/^\d{4}$/.test(String(year || '')))
      return res.status(400).json({ ok: false, error: 'Invalid year' });

    const y = sanitizeSegment(year);
    const s = sanitizeSegment(slug);
    const f = sanitizeFilename(filename);
    const rel = path.posix.join(y, s, f);
    const abs = path.join(config.content.imagesDir, rel);

    if (!fs.existsSync(abs)) return res.status(404).json({ ok: false, error: 'Not found' });
    await fse.unlink(abs);

    // attempt to remove variant with -w*.webp
    const base = f.replace(/\.[^.]+$/, '');
    const variantCandidates = fs
      .readdirSync(path.dirname(abs))
      .filter(n => n.startsWith(base + '-w') && n.endsWith('.webp'));
    for (const cand of variantCandidates) {
      try { await fse.unlink(path.join(path.dirname(abs), cand)); } catch (_) {}
    }

    return res.json({ ok: true, data: { deleted: true, path: `/images/${rel}` } });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/images/chat-upload
 * Upload image to R2 for AI Chat and perform vision analysis
 * 
 * Architecture:
 *   1. Upload image to R2 storage
 *   2. Get public R2 URL
 *   3. Pass URL to n8n vision workflow (n8n fetches image from R2)
 *   4. Return upload info + vision analysis
 * 
 * Returns: { url, key, size, contentType, imageAnalysis? }
 */
router.post('/chat-upload', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ ok: false, error: 'file is required' });
    }

    // Check if R2 is configured
    if (!isR2Configured()) {
      return res.status(503).json({
        ok: false,
        error: 'R2 storage not configured (set CF_ACCOUNT_ID, CF_API_TOKEN)',
      });
    }

    // Generate R2 key
    const key = generateKey(file.originalname || 'image', 'ai-chat');

    // Upload to R2
    const result = await r2Upload(key, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
    });

    // Perform AI vision analysis if it's an image
    // Use R2 URL instead of base64 - n8n will fetch the image directly
    let imageAnalysis = null;
    if (file.mimetype?.startsWith('image/')) {
      try {
        const client = getN8NClient();
        
        const analysisPrompt = `이 이미지를 분석해주세요. 다음 내용을 간결하게 설명해주세요:
1. 이미지에 보이는 주요 요소들
2. 전체적인 분위기나 맥락
3. 텍스트가 있다면 해당 내용

한국어로 2-3문장으로 간결하게 요약해주세요.`;

        // Pass R2 URL to n8n - n8n workflow will fetch the image
        imageAnalysis = await client.vision(result.url, analysisPrompt, {
          mimeType: file.mimetype,
          model: 'gpt-4o',
        });
      } catch (err) {
        // Vision analysis failed, but upload succeeded - continue without analysis
        console.error('Vision analysis failed:', err.message);
      }
    }

    return res.status(201).json({
      ok: true,
      data: {
        url: result.url,
        key: result.key,
        size: result.size,
        contentType: result.contentType,
        imageAnalysis,
      },
    });
  } catch (err) {
    console.error('chat-upload error:', err);
    return next(err);
  }
});

export default router;
