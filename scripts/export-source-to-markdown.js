#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_OUTPUT = 'source-code-export.md';
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;

const EXCLUDED_DIRS = new Set([
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'coverage',
  'dist',
  'build',
  'out',
  'tmp',
  'temp',
  'node_modules',
  '.turbo',
  '.cache',
]);

const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  '.DS_Store',
]);

const INCLUDED_EXTENSIONS = new Set([
  '.js',
  '.cjs',
  '.mjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.html',
  '.xml',
  '.svg',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
  '.py',
  '.rb',
  '.php',
  '.java',
  '.kt',
  '.go',
  '.rs',
  '.c',
  '.cc',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.swift',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.conf',
  '.env',
]);

function parseArgs(argv) {
  const options = {
    rootDir: process.cwd(),
    output: DEFAULT_OUTPUT,
    maxFileSize: DEFAULT_MAX_FILE_SIZE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--root') {
      options.rootDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--out') {
      options.output = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--max-size') {
      options.maxFileSize = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!Number.isFinite(options.maxFileSize) || options.maxFileSize <= 0) {
    throw new Error('--max-size must be a positive number.');
  }

  if (!path.isAbsolute(options.output)) {
    options.output = path.resolve(options.rootDir, options.output);
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/export-source-to-markdown.js [options]

Options:
  --root <dir>       Root directory to scan. Default: current directory
  --out <file>       Output markdown file. Default: ${DEFAULT_OUTPUT}
  --max-size <bytes> Maximum file size to include. Default: ${DEFAULT_MAX_FILE_SIZE}
  -h, --help         Show this help
`);
}

function shouldIncludeFile(filePath, stat, maxFileSize) {
  if (!stat.isFile()) {
    return false;
  }

  const fileName = path.basename(filePath);
  if (EXCLUDED_FILES.has(fileName)) {
    return false;
  }

  const extension = path.extname(filePath).toLowerCase();
  if (!INCLUDED_EXTENSIONS.has(extension)) {
    return false;
  }

  if (stat.size > maxFileSize) {
    return false;
  }

  return true;
}

function walk(dirPath, rootDir, collector, maxFileSize) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);

    if (!relativePath) {
      continue;
    }

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      walk(absolutePath, rootDir, collector, maxFileSize);
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

    if (stat.size > maxFileSize) {
      continue;
    }

    if (shouldIncludeFile(absolutePath, stat, maxFileSize)) {
      collector.push(relativePath);
    }
  }
}

function detectLanguage(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const languageMap = {
    '.js': 'js',
    '.cjs': 'js',
    '.mjs': 'js',
    '.jsx': 'jsx',
    '.ts': 'ts',
    '.tsx': 'tsx',
    '.json': 'json',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.html': 'html',
    '.xml': 'xml',
    '.svg': 'xml',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'bash',
    '.sql': 'sql',
    '.py': 'python',
    '.rb': 'ruby',
    '.php': 'php',
    '.java': 'java',
    '.kt': 'kotlin',
    '.go': 'go',
    '.rs': 'rust',
    '.c': 'c',
    '.cc': 'cpp',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.swift': 'swift',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.ini': 'ini',
    '.conf': 'conf',
    '.env': 'dotenv',
  };

  return languageMap[extension] || '';
}

function buildMarkdown(rootDir, files) {
  const lines = [];
  const generatedAt = new Date().toISOString();

  lines.push('# Source Code Export');
  lines.push('');
  lines.push(`- Root: \`${rootDir}\``);
  lines.push(`- Generated at: \`${generatedAt}\``);
  lines.push(`- Files: \`${files.length}\``);
  lines.push('');
  lines.push('## File List');
  lines.push('');

  for (const file of files) {
    lines.push(`- \`${file}\``);
  }

  for (const file of files) {
    const absolutePath = path.join(rootDir, file);
    const content = fs.readFileSync(absolutePath, 'utf8');
    const language = detectLanguage(file);

    lines.push('');
    lines.push(`## ${file}`);
    lines.push('');
    lines.push('```' + language);
    lines.push(content);
    lines.push('```');
  }

  lines.push('');
  return `${lines.join('\n')}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = [];

  walk(options.rootDir, options.rootDir, files, options.maxFileSize);
  files.sort((left, right) => left.localeCompare(right));

  const markdown = buildMarkdown(options.rootDir, files);
  fs.writeFileSync(options.output, markdown, 'utf8');

  console.log(`Exported ${files.length} files to ${options.output}`);
}

main();
