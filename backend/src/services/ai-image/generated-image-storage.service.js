import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import fse from 'fs-extra';
import sharp from 'sharp';
import { config } from '../../config.js';
import { BadGatewayError, BadRequestError } from '../../middleware/errorHandler.js';

const BLOCKED_TEXT_PREFIXES = ['<svg', '<?xml', '<!doctype', '<html'];

function sanitizeSegment(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

function sanitizeSubdir(value) {
  const segment = sanitizeSegment(value || 'ai');
  return segment || 'ai';
}

function sanitizeMarkdownAlt(value) {
  const alt = String(value || 'AI generated image')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return (alt || 'AI generated image').replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
}

function buildTimestamp(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14);
}

function ensureInsideImagesDir(targetDir) {
  const imagesRoot = path.resolve(config.content.imagesDir);
  const resolved = path.resolve(targetDir);
  if (resolved !== imagesRoot && !resolved.startsWith(`${imagesRoot}${path.sep}`)) {
    throw new BadRequestError('Invalid image storage path');
  }
  return resolved;
}

function rejectObviousNonRaster(buffer) {
  const prefix = buffer.subarray(0, 64).toString('utf8').trim().toLowerCase();
  if (BLOCKED_TEXT_PREFIXES.some((entry) => prefix.startsWith(entry))) {
    throw new BadGatewayError('AI image response was not a raster image');
  }
}

async function normalizePng(buffer, maxOutputBytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new BadGatewayError('AI image response was empty');
  }
  if (buffer.length > maxOutputBytes) {
    throw new BadGatewayError('AI image response exceeded the output byte limit', {
      maxOutputBytes,
    });
  }

  rejectObviousNonRaster(buffer);

  let image;
  try {
    image = sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.format === 'svg') {
      throw new Error('Unsupported image metadata');
    }
    const png = await image.png({ compressionLevel: 9 }).toBuffer();
    if (png.length > maxOutputBytes) {
      throw new Error('Normalized PNG exceeds byte limit');
    }
    return {
      buffer: png,
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    throw new BadGatewayError('AI image response could not be decoded as a raster image', {
      message: error.message,
    });
  }
}

async function buildWebpVariant(pngBuffer, baseName, destDirAbs, relDir) {
  const image = sharp(pngBuffer, { failOn: 'error' });
  const metadata = await image.metadata();
  const maxWidth = 1024;
  const sourceWidth = metadata.width || maxWidth;
  const width = Math.min(sourceWidth, maxWidth);
  const resized = sourceWidth > maxWidth ? image.resize({ width: maxWidth }) : image;
  const webpBuffer = await resized.webp({ quality: 82 }).toBuffer();
  const filename = `${baseName}-w${width}.webp`;
  await fse.writeFile(path.join(destDirAbs, filename), webpBuffer);

  return {
    filename,
    path: path.posix.join(relDir, filename),
    url: `/images/${relDir}/${filename}`,
    width,
    sizeBytes: webpBuffer.length,
  };
}

function uniqueFilename(destDirAbs, desiredName) {
  let filename = desiredName;
  const ext = path.extname(desiredName);
  const base = desiredName.slice(0, -ext.length);
  let counter = 1;
  while (fs.existsSync(path.join(destDirAbs, filename))) {
    filename = `${base}-${counter}${ext}`;
    counter += 1;
  }
  return filename;
}

export class GeneratedImageStorageService {
  buildDirectory({ year, slug, subdir }) {
    const normalizedYear = sanitizeSegment(year);
    const normalizedSlug = sanitizeSegment(slug);
    if (!/^\d{4}$/.test(normalizedYear)) {
      throw new BadRequestError('year must be YYYY');
    }
    if (!normalizedSlug) {
      throw new BadRequestError('slug is required for AI image storage');
    }

    const normalizedSubdir = sanitizeSubdir(subdir || config.ai?.image?.storageSubdir);
    const rel = path.posix.join(normalizedYear, normalizedSlug, normalizedSubdir);
    const abs = ensureInsideImagesDir(path.join(config.content.imagesDir, rel));
    return { abs, rel };
  }

  async saveImages({ year, slug, subdir, images, alt }) {
    const { abs, rel } = this.buildDirectory({ year, slug, subdir });
    await fse.ensureDir(abs);

    const maxOutputBytes = config.ai?.image?.maxOutputBytes || 12_582_912;
    const safeAlt = sanitizeMarkdownAlt(alt);
    const timestamp = buildTimestamp();
    const items = [];

    for (let index = 0; index < images.length; index += 1) {
      const source = images[index];
      const normalized = await normalizePng(source.buffer, maxOutputBytes);
      const hash = crypto.createHash('sha256').update(normalized.buffer).digest('hex').slice(0, 10);
      const ordinal = String(index + 1).padStart(2, '0');
      const baseName = `generated-${timestamp}-${ordinal}-${hash}`;
      const filename = uniqueFilename(abs, `${baseName}.png`);
      const resolvedBaseName = filename.replace(/\.png$/i, '');

      await fse.writeFile(path.join(abs, filename), normalized.buffer);

      let variantWebp = null;
      try {
        variantWebp = await buildWebpVariant(normalized.buffer, resolvedBaseName, abs, rel);
      } catch {
        variantWebp = null;
      }

      const url = `/images/${rel}/${filename}`;
      const markdownUrl = variantWebp?.url || url;
      items.push({
        filename,
        path: path.posix.join(rel, filename),
        url,
        variantWebp,
        alt: safeAlt,
        markdown: `![${safeAlt}](${markdownUrl})`,
        source: 'ai-generated',
        width: normalized.width,
        height: normalized.height,
        sizeBytes: normalized.buffer.length,
      });
    }

    return {
      dir: `/images/${rel}`,
      items,
    };
  }
}

export const generatedImageStorageService = new GeneratedImageStorageService();
