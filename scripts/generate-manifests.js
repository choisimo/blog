#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const postsDir = path.join(process.cwd(), 'public', 'posts');

function generateManifestForYear(year) {
  const yearDir = path.join(postsDir, year);
  
  if (!fs.existsSync(yearDir)) {
    console.log(`Directory ${yearDir} does not exist, skipping...`);
    return;
  }
  
  const files = fs.readdirSync(yearDir)
    .filter(file => file.endsWith('.md'))
    .sort();
  
  const manifest = {
    files: files
  };
  
  const manifestPath = path.join(yearDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  
  console.log(`Generated manifest for ${year}: ${files.length} files`);
}

function generateAllManifests() {
  if (!fs.existsSync(postsDir)) {
    console.error('Posts directory does not exist');
    process.exit(1);
  }
  
  const years = fs.readdirSync(postsDir)
    .filter(item => fs.statSync(path.join(postsDir, item)).isDirectory())
    .filter(year => /^\d{4}$/.test(year)); // Only 4-digit year directories
  
  console.log(`Found year directories: ${years.join(', ')}`);
  
  years.forEach(generateManifestForYear);
  
  console.log('All manifests generated successfully!');
}

generateAllManifests();