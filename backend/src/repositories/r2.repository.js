import { config } from '../config.js';
import fs from 'node:fs/promises';
import path from 'node:path';

function normalizeKey(key) {
  const raw = String(key || '').replace(/^\/+/, '');
  const normalized = path.posix.normalize(raw);
  if (!normalized || normalized === '.' || normalized.startsWith('..') || normalized.includes('/../')) {
    throw new Error('Invalid key');
  }
  return normalized;
}

function getAssetsBaseUrl() {
  const fromConfig = config.assetsBaseUrl;
  if (fromConfig && String(fromConfig).trim()) {
    return String(fromConfig).trim().replace(/\/$/, '');
  }
  const site = String(config.siteBaseUrl || '').replace(/\/$/, '');
  return `${site}/images`;
}

function getLocalPathForKey(key) {
  const k = normalizeKey(key);
  return {
    key: k,
    abs: path.join(config.content.imagesDir, k),
    url: `${getAssetsBaseUrl()}/${k}`,
  };
}

export function isR2Configured() {
  return true;
}

export async function upload(key, data, options = {}) {
  const loc = getLocalPathForKey(key);
  await fs.mkdir(path.dirname(loc.abs), { recursive: true });
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await fs.writeFile(loc.abs, buf);

  return {
    key: loc.key,
    url: loc.url,
    size: buf.byteLength,
    contentType: options.contentType || 'application/octet-stream',
  };
}

export async function deleteObject(key) {
  const loc = getLocalPathForKey(key);
  try {
    await fs.unlink(loc.abs);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  return { deleted: true };
}

export async function head(key) {
  const loc = getLocalPathForKey(key);
  try {
    const stat = await fs.stat(loc.abs);
    return {
      key: loc.key,
      size: stat.size,
      contentType: null,
      etag: null,
    };
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

export function generateKey(filename, prefix = 'uploads') {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const timestamp = Date.now();
  const year = new Date().getFullYear();
  return `${prefix}/${year}/${timestamp}-${sanitized}`;
}
