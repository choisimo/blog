#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  EXCLUDED_DIRS: BASE_EXCLUDED_DIRS,
  EXCLUDED_FILES: BASE_EXCLUDED_FILES,
  EXCLUDED_PATH_PATTERNS: BASE_EXCLUDED_PATH_PATTERNS,
  INCLUDED_EXTENSIONS: BASE_INCLUDED_EXTENSIONS,
  normalizeRelativePath,
} = require('./export-source-to-markdown.js');

const DEFAULT_OUTPUT = 'source-code-export.tar.gz';

const EXCLUDED_DIRS = new Set([
  ...BASE_EXCLUDED_DIRS,
  'docs',
]);

const EXCLUDED_FILES = new Set([
  ...BASE_EXCLUDED_FILES,
  DEFAULT_OUTPUT,
  'source-code-export.md',
]);

const EXCLUDED_PATH_PATTERNS = [
  ...BASE_EXCLUDED_PATH_PATTERNS,
  /^docs\//,
];

const INCLUDED_EXTENSIONS = new Set(
  [...BASE_INCLUDED_EXTENSIONS].filter((extension) => extension !== '.svg')
);

const INCLUDED_FILENAMES = new Set([
  '.dockerignore',
  '.gitignore',
  '.npmrc',
  '.prettierignore',
  'Dockerfile',
  'Makefile',
  'Procfile',
]);

function parseArgs(argv) {
  const options = {
    rootDir: process.cwd(),
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--root') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--root requires a value.');
      }

      options.rootDir = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === '--out') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--out requires a value.');
      }

      options.output = value;
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!path.isAbsolute(options.output)) {
    options.output = path.resolve(options.rootDir, options.output);
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/archive-source-code.js [options]

Options:
  --root <dir> Root directory to scan. Default: current directory
  --out <file> Output tar.gz path. Default: ${DEFAULT_OUTPUT}
  -h, --help   Show this help
`);
}

function shouldExcludePath(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const fileName = path.basename(normalizedPath);

  if (/^\.env(\..+)?$/.test(fileName)) {
    return true;
  }

  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}

function hasIncludedFilename(fileName) {
  if (INCLUDED_FILENAMES.has(fileName)) {
    return true;
  }

  return fileName.startsWith('Dockerfile');
}

function shouldIncludeFile(filePath, stat) {
  if (!stat.isFile()) {
    return false;
  }

  const fileName = path.basename(filePath);
  if (EXCLUDED_FILES.has(fileName)) {
    return false;
  }

  if (/^\.env(\..+)?$/.test(fileName)) {
    return false;
  }

  if (hasIncludedFilename(fileName)) {
    return true;
  }

  const extension = path.extname(fileName).toLowerCase();
  return INCLUDED_EXTENSIONS.has(extension);
}

function walk(dirPath, rootDir, collector) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    const relativePath = normalizeRelativePath(path.relative(rootDir, absolutePath));

    if (!relativePath) {
      continue;
    }

    if (shouldExcludePath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      walk(absolutePath, rootDir, collector);
      continue;
    }

    let stat;
    try {
      stat = fs.lstatSync(absolutePath);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        continue;
      }

      throw error;
    }

    if (stat.isSymbolicLink()) {
      continue;
    }

    if (shouldIncludeFile(absolutePath, stat)) {
      collector.push(relativePath);
    }
  }
}

function collectSourceFiles(rootDir) {
  const files = [];
  walk(rootDir, rootDir, files);
  files.sort((left, right) => left.localeCompare(right));
  return files;
}

function createArchive(rootDir, outputPath, files) {
  if (!files.length) {
    throw new Error('No source files matched the archive rules.');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const fileList = Buffer.from(`${files.join('\0')}\0`, 'utf8');
  const result = spawnSync(
    'tar',
    ['-czf', outputPath, '-C', rootDir, '--null', '-T', '-'],
    {
      input: fileList,
      encoding: 'utf8',
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || 'tar failed').trim();
    throw new Error(stderr);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = collectSourceFiles(options.rootDir);

  createArchive(options.rootDir, options.output, files);

  console.log(`Archived ${files.length} files to ${options.output}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_OUTPUT,
  EXCLUDED_DIRS,
  EXCLUDED_FILES,
  EXCLUDED_PATH_PATTERNS,
  INCLUDED_EXTENSIONS,
  INCLUDED_FILENAMES,
  parseArgs,
  printHelp,
  shouldExcludePath,
  shouldIncludeFile,
  walk,
  collectSourceFiles,
  createArchive,
  main,
};
