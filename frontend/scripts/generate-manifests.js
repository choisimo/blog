#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const postsDir = path.join(process.cwd(), 'public', 'posts');

function normalizeImagePath(rawPath, markdownAbsPath) {
  if (!rawPath) return undefined;
  if (/^https?:\/\//i.test(rawPath) || rawPath.startsWith('data:')) {
    return rawPath;
  }

  const markdownDir = path.dirname(markdownAbsPath);
  const absolutePath = path.resolve(markdownDir, rawPath);
  const publicDir = path.join(process.cwd(), 'public');
  const relativeToPublic = path.relative(publicDir, absolutePath);

  if (relativeToPublic && !relativeToPublic.startsWith('..')) {
    return `/${relativeToPublic.replace(/\\/g, '/')}`;
  }

  if (rawPath.startsWith('/')) {
    return rawPath;
  }

  const stripped = rawPath.replace(/^\.\/?/, '').replace(/^\.\./, '');
  return `/${stripped}`;
}

function extractCoverImage(frontmatter, body, markdownAbsPath) {
  const fmCover = frontmatter.coverImage || frontmatter.cover;
  if (fmCover) {
    return normalizeImagePath(fmCover, markdownAbsPath);
  }

  const markdownImageMatch = body.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (markdownImageMatch?.[1]) {
    return normalizeImagePath(markdownImageMatch[1], markdownAbsPath);
  }

  const htmlImageMatch = body.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlImageMatch?.[1]) {
    return normalizeImagePath(htmlImageMatch[1], markdownAbsPath);
  }

  return undefined;
}

function validateMarkdownFile(filePath, filename) {
  // Check for invalid filenames
  if (filename === '.md' || filename.startsWith('.md')) {
    console.error(`❌ Invalid filename detected: "${filename}" in ${filePath}`);
    console.error(`   This file has an empty name before the .md extension`);
    return false;
  }

  // Check for files starting with dot (hidden files)
  if (filename.startsWith('.') && filename !== '.md') {
    console.warn(`⚠️  Hidden file detected: "${filename}" - skipping`);
    return false;
  }

  // Check for proper filename format (should have alphanumeric characters, hyphens, underscores)
  const validFilenamePattern = /^[a-zA-Z0-9][a-zA-Z0-9\-_]*\.md$/;
  if (!validFilenamePattern.test(filename)) {
    console.warn(
      `⚠️  Potentially problematic filename: "${filename}" - consider using alphanumeric characters, hyphens, and underscores only`
    );
  }

  // Validate file content
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if file is empty
    if (content.trim().length === 0) {
      console.error(`❌ Empty file detected: "${filename}"`);
      return false;
    }

    // Check for frontmatter
    if (!content.startsWith('---')) {
      console.warn(
        `⚠️  No frontmatter detected in: "${filename}" - this may cause display issues`
      );
    }

    // Check for title in frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      if (!frontmatter.includes('title:')) {
        console.warn(`⚠️  No title found in frontmatter for: "${filename}"`);
      }
    }
  } catch (error) {
    console.error(`❌ Error reading file "${filename}": ${error.message}`);
    return false;
  }

  return true;
}

function generateManifestForYear(year) {
  const yearDir = path.join(postsDir, year);

  if (!fs.existsSync(yearDir)) {
    console.log(`Directory ${yearDir} does not exist, skipping...`);
    return;
  }

  const allFiles = fs.readdirSync(yearDir).filter(file => file.endsWith('.md'));

  console.log(`\n📁 Processing ${year} directory...`);

  const validFiles = [];
  const invalidFiles = [];

  for (const file of allFiles) {
    const filePath = path.join(yearDir, file);
    console.log(`   Validating: ${file}`);

    if (validateMarkdownFile(filePath, file)) {
      validFiles.push(file);
      console.log(`   ✅ Valid: ${file}`);
    } else {
      invalidFiles.push(file);
      console.log(`   ❌ Invalid: ${file}`);
    }
  }

  if (invalidFiles.length > 0) {
    console.error(
      `\n🚨 Found ${invalidFiles.length} invalid file(s) in ${year}:`
    );
    invalidFiles.forEach(file => {
      console.error(`   - ${file}`);
    });
    console.error(`\n💡 Suggestions:`);
    console.error(`   - Rename files with proper names (e.g., "my-post.md")`);
    console.error(`   - Ensure files have valid frontmatter with title`);
    console.error(`   - Remove empty files`);
    console.error(`\n⚠️  Invalid files will be excluded from the manifest.`);
  }

  const sortedValidFiles = validFiles.sort();

  const manifest = {
    files: sortedValidFiles,
    generatedAt: new Date().toISOString(),
    totalFiles: sortedValidFiles.length,
    excludedFiles: invalidFiles.length,
  };

  const manifestPath = path.join(yearDir, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\n📄 Generated manifest for ${year}:`);
  console.log(`   ✅ Valid files: ${sortedValidFiles.length}`);
  console.log(`   ❌ Excluded files: ${invalidFiles.length}`);

  return { valid: sortedValidFiles.length, invalid: invalidFiles.length };
}

function generateUnifiedManifest(years) {
  console.log('\n📄 Generating unified posts manifest...');

  const items = [];

  for (const year of years) {
    const yearDir = path.join(postsDir, year);
    if (!fs.existsSync(yearDir)) continue;

    const files = fs.readdirSync(yearDir).filter(file => file.endsWith('.md'));

    for (const file of files) {
      const abs = path.join(yearDir, file);
      if (!validateMarkdownFile(abs, file)) continue;

      const raw = fs.readFileSync(abs, 'utf8');
      const { data: fm, content: body } = matter(raw);

      const filename = path.basename(file, '.md');
      const slug = fm.slug || filename;
      const date = fm.date || `${year}-01-01`;
      const tags = Array.isArray(fm.tags) ? fm.tags : [];
      const category = fm.category || 'General';
      const author = fm.author || 'Admin';
      const published = fm.published !== false;
      const coverImage = extractCoverImage(fm, body, abs);

      // Compute snippet and reading time
      const textOnly = body
        // strip code fences
        .replace(/```[\s\S]*?```/g, '')
        // strip html tags if any
        .replace(/<[^>]+>/g, '')
        .trim();
      const snippet = (fm.description || fm.excerpt || textOnly)
        .slice(0, 200)
        .trim();
      const words = textOnly.split(/\s+/).filter(Boolean).length;
      const minutes = Math.max(1, Math.ceil(words / 200));
      const readingTime = `${minutes} min read`;

      items.push({
        path: `/posts/${year}/${file}`,
        year,
        slug,
        title:
          fm.title ||
          slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
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
      });
    }
  }

  // Sort by date desc
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const unifiedManifest = {
    total: items.length,
    items,
    generatedAt: new Date().toISOString(),
    years: years.sort().reverse(),
    format: 2, // version marker for clients
  };

  const publicDir = path.join(process.cwd(), 'public');
  const unifiedManifestPathRoot = path.join(publicDir, 'posts-manifest.json');
  const unifiedManifestPathNested = path.join(
    publicDir,
    'posts',
    'posts-manifest.json'
  );
  // ensure nested dir exists
  fs.mkdirSync(path.dirname(unifiedManifestPathNested), { recursive: true });

  const payload = `${JSON.stringify(unifiedManifest, null, 2)}\n`;
  fs.writeFileSync(unifiedManifestPathRoot, payload);
  fs.writeFileSync(unifiedManifestPathNested, payload);

  console.log(`✅ Generated unified manifest: ${items.length} posts`);
  console.log(`   Saved to: posts-manifest.json and posts/posts-manifest.json`);

  return items.length;
}

function generateAllManifests() {
  console.log('🚀 Starting manifest generation with validation...\n');

  if (!fs.existsSync(postsDir)) {
    console.error('❌ Posts directory does not exist');
    process.exit(1);
  }

  const years = fs
    .readdirSync(postsDir)
    .filter(item => fs.statSync(path.join(postsDir, item)).isDirectory())
    .filter(year => /^\d{4}$/.test(year)); // Only 4-digit year directories

  console.log(`📅 Found year directories: ${years.join(', ')}\n`);

  let totalValid = 0;
  let totalInvalid = 0;

  // Generate individual year manifests
  for (const year of years) {
    const result = generateManifestForYear(year);
    if (result) {
      totalValid += result.valid;
      totalInvalid += result.invalid;
    }
  }

  // Generate unified manifest for postService
  const unifiedPostCount = generateUnifiedManifest(years);

  console.log('\n🎉 Manifest generation completed!');
  console.log(`📊 Summary:`);
  console.log(`   ✅ Total valid files: ${totalValid}`);
  console.log(`   ❌ Total excluded files: ${totalInvalid}`);
  console.log(`   📄 Unified manifest: ${unifiedPostCount} posts`);

  if (totalInvalid > 0) {
    console.log(
      `\n⚠️  ${totalInvalid} file(s) were excluded due to validation errors.`
    );
    console.log(
      `   Please fix these issues for the files to appear on your blog.`
    );
    process.exit(1); // Exit with error code to fail CI/CD if there are invalid files
  }

  console.log('\n✨ All files are valid and ready for deployment!');
}

generateAllManifests();
