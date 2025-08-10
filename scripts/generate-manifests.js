#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const postsDir = path.join(process.cwd(), 'public', 'posts');

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
    console.warn(`⚠️  Potentially problematic filename: "${filename}" - consider using alphanumeric characters, hyphens, and underscores only`);
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
      console.warn(`⚠️  No frontmatter detected in: "${filename}" - this may cause display issues`);
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
  
  const allFiles = fs.readdirSync(yearDir)
    .filter(file => file.endsWith('.md'));
  
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
    console.error(`\n🚨 Found ${invalidFiles.length} invalid file(s) in ${year}:`);
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
    excludedFiles: invalidFiles.length
  };
  
  const manifestPath = path.join(yearDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  
  console.log(`\n📄 Generated manifest for ${year}:`);
  console.log(`   ✅ Valid files: ${sortedValidFiles.length}`);
  console.log(`   ❌ Excluded files: ${invalidFiles.length}`);
  
  return { valid: sortedValidFiles.length, invalid: invalidFiles.length };
}

function generateAllManifests() {
  console.log('🚀 Starting manifest generation with validation...\n');
  
  if (!fs.existsSync(postsDir)) {
    console.error('❌ Posts directory does not exist');
    process.exit(1);
  }
  
  const years = fs.readdirSync(postsDir)
    .filter(item => fs.statSync(path.join(postsDir, item)).isDirectory())
    .filter(year => /^\d{4}$/.test(year)); // Only 4-digit year directories
  
  console.log(`📅 Found year directories: ${years.join(', ')}\n`);
  
  let totalValid = 0;
  let totalInvalid = 0;
  
  for (const year of years) {
    const result = generateManifestForYear(year);
    if (result) {
      totalValid += result.valid;
      totalInvalid += result.invalid;
    }
  }
  
  console.log('\n🎉 Manifest generation completed!');
  console.log(`📊 Summary:`);
  console.log(`   ✅ Total valid files: ${totalValid}`);
  console.log(`   ❌ Total excluded files: ${totalInvalid}`);
  
  if (totalInvalid > 0) {
    console.log(`\n⚠️  ${totalInvalid} file(s) were excluded due to validation errors.`);
    console.log(`   Please fix these issues for the files to appear on your blog.`);
    process.exit(1); // Exit with error code to fail CI/CD if there are invalid files
  }
  
  console.log('\n✨ All files are valid and ready for deployment!');
}

generateAllManifests();
