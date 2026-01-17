/**
 * Local asset storage
 *
 * Stores uploaded files on the local filesystem under CONTENT_IMAGES_DIR.
 */

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

/**
 * Check if R2 is configured
 * @returns {boolean}
 */
export function isR2Configured() {
  return true;
}

/**
 * Upload a file to R2
 * @param {string} key - Object key (path in bucket)
 * @param {Buffer|ArrayBuffer|Uint8Array} data - File data
 * @param {object} options - Upload options
 * @returns {Promise<{key: string, url: string, size: number}>}
 */
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

/**
 * Delete an object from R2
 * @param {string} key - Object key
 * @returns {Promise<{deleted: boolean}>}
 */
export async function deleteObject(key) {
  const loc = getLocalPathForKey(key);
  try {
    await fs.unlink(loc.abs);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  return { deleted: true };
}

/**
 * Get object metadata from R2
 * @param {string} key - Object key
 * @returns {Promise<object|null>}
 */
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

/**
 * Generate a unique key for uploads
 * @param {string} filename - Original filename
 * @param {string} prefix - Key prefix (e.g., 'ai-chat', 'posts')
 * @returns {string}
 */
export function generateKey(filename, prefix = 'uploads') {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const timestamp = Date.now();
  const year = new Date().getFullYear();
  return `${prefix}/${year}/${timestamp}-${sanitized}`;
}
