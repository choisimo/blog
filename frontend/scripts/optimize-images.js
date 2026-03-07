#!/usr/bin/env node
/**
 * Image Optimization Script
 * 
 * Generates optimized thumbnail versions of images for faster page loads.
 * Original images are preserved for full-size viewing (lightbox).
 * 
 * Usage: node scripts/optimize-images.js
 * 
 * Output structure:
 *   /public/images/2025/post-name/image.png (original)
 *   /public/images/2025/post-name/image.thumb.webp (thumbnail - 800px width, webp)
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const POSTS_DIR = path.join(PUBLIC_DIR, 'posts');

// Thumbnail settings
const THUMB_WIDTH = 800; // Max width for thumbnails
const THUMB_QUALITY = 80; // WebP quality (0-100)
const THUMB_SUFFIX = '.thumb.webp';

// Skip files smaller than this (already optimized)
const MIN_SIZE_BYTES = 50 * 1024; // 50KB

// Supported image extensions
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

async function findImages(dir) {
  const images = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subImages = await findImages(fullPath);
        images.push(...subImages);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        // Skip already generated thumbnails
        if (entry.name.includes('.thumb.')) continue;
        
        if (IMAGE_EXTENSIONS.includes(ext)) {
          images.push(fullPath);
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Error reading directory ${dir}:`, err.message);
    }
  }
  
  return images;
}

async function getThumbPath(imagePath) {
  const dir = path.dirname(imagePath);
  const ext = path.extname(imagePath);
  const base = path.basename(imagePath, ext);
  return path.join(dir, `${base}${THUMB_SUFFIX}`);
}

async function needsOptimization(imagePath, thumbPath) {
  try {
    const [origStat, thumbStat] = await Promise.all([
      fs.stat(imagePath),
      fs.stat(thumbPath).catch(() => null),
    ]);
    
    // Skip small files
    if (origStat.size < MIN_SIZE_BYTES) {
      return false;
    }
    
    // Generate if thumb doesn't exist or is older than original
    if (!thumbStat) return true;
    if (thumbStat.mtime < origStat.mtime) return true;
    
    return false;
  } catch {
    return true;
  }
}

async function optimizeImage(imagePath) {
  const thumbPath = await getThumbPath(imagePath);
  
  if (!(await needsOptimization(imagePath, thumbPath))) {
    return { skipped: true, path: imagePath };
  }
  
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // Only resize if wider than THUMB_WIDTH
    const resizeOptions = metadata.width > THUMB_WIDTH
      ? { width: THUMB_WIDTH, withoutEnlargement: true }
      : {};
    
    await image
      .resize(resizeOptions)
      .webp({ quality: THUMB_QUALITY })
      .toFile(thumbPath);
    
    const [origStat, thumbStat] = await Promise.all([
      fs.stat(imagePath),
      fs.stat(thumbPath),
    ]);
    
    const savings = ((1 - thumbStat.size / origStat.size) * 100).toFixed(1);
    
    return {
      skipped: false,
      path: imagePath,
      thumbPath,
      originalSize: origStat.size,
      thumbSize: thumbStat.size,
      savings: `${savings}%`,
    };
  } catch (err) {
    return {
      skipped: false,
      path: imagePath,
      error: err.message,
    };
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  console.log('🖼️  Image Optimization Script');
  console.log('============================\n');
  
  // Find all images in /public/images and /public/posts
  const [imagesInImages, imagesInPosts] = await Promise.all([
    findImages(IMAGES_DIR),
    findImages(POSTS_DIR),
  ]);
  
  const allImages = [...imagesInImages, ...imagesInPosts];
  
  console.log(`Found ${allImages.length} images to process\n`);
  
  if (allImages.length === 0) {
    console.log('No images found. Exiting.');
    return;
  }
  
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let totalSaved = 0;
  
  for (const imagePath of allImages) {
    const result = await optimizeImage(imagePath);
    
    if (result.skipped) {
      skipped++;
    } else if (result.error) {
      errors++;
      console.error(`❌ ${path.relative(PUBLIC_DIR, imagePath)}: ${result.error}`);
    } else {
      processed++;
      totalSaved += result.originalSize - result.thumbSize;
      console.log(
        `✅ ${path.relative(PUBLIC_DIR, imagePath)}: ` +
        `${formatBytes(result.originalSize)} → ${formatBytes(result.thumbSize)} ` +
        `(${result.savings} saved)`
      );
    }
  }
  
  console.log('\n============================');
  console.log(`📊 Summary:`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Skipped (small/up-to-date): ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total saved: ${formatBytes(totalSaved)}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
