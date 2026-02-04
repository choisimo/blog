#!/usr/bin/env node

/**
 * Export Codebase to Markdown
 * 
 * 전체 프로젝트 코드를 마크다운 파일로 저장하고
 * dolphin 파일 브라우저로 해당 디렉토리를 엽니다.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// 설정
const CONFIG = {
  outputDir: path.join(__dirname, 'codebase-export'),
  outputFile: 'codebase.md',
  // 제외할 디렉토리
  excludeDirs: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '.cache',
    '.turbo',
    'codebase-export',
    '__pycache__',
    '.venv',
    'venv',
  ],
  // 제외할 파일 패턴
  excludeFiles: [
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    '.DS_Store',
    'Thumbs.db',
  ],
  // 포함할 파일 확장자
  includeExtensions: [
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.json', '.yaml', '.yml',
    '.md', '.mdx',
    '.css', '.scss', '.less',
    '.html', '.htm',
    '.sql',
    '.sh', '.bash',
    '.py',
    '.go',
    '.env.example',
    '.gitignore',
    '.prettierrc', '.eslintrc',
    'Dockerfile',
    '.toml',
  ],
  // 특별히 포함할 파일명 (확장자 없는 파일 등)
  includeFiles: [
    'Dockerfile',
    'Makefile',
    '.gitignore',
    '.env.example',
    '.env.production.example',
    '.env.test.example',
    'CNAME',
  ],
};

// 언어 매핑 (마크다운 코드블록용)
const LANG_MAP = {
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
  '.mdx': 'mdx',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.htm': 'html',
  '.sql': 'sql',
  '.sh': 'bash',
  '.bash': 'bash',
  '.py': 'python',
  '.go': 'go',
  '.toml': 'toml',
};

/**
 * 파일이 포함 대상인지 확인
 */
function shouldIncludeFile(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath);

  // 제외 파일 체크
  if (CONFIG.excludeFiles.includes(fileName)) {
    return false;
  }

  // 특별 포함 파일 체크
  if (CONFIG.includeFiles.includes(fileName)) {
    return true;
  }

  // 확장자 체크
  return CONFIG.includeExtensions.includes(ext);
}

/**
 * 디렉토리가 제외 대상인지 확인
 */
function shouldExcludeDir(dirName) {
  return CONFIG.excludeDirs.includes(dirName);
}

/**
 * 파일 확장자에 따른 언어 반환
 */
function getLanguage(filePath) {
  const ext = path.extname(filePath);
  const fileName = path.basename(filePath);

  if (fileName === 'Dockerfile') return 'dockerfile';
  if (fileName === 'Makefile') return 'makefile';
  if (fileName.startsWith('.env')) return 'bash';
  if (fileName === '.gitignore') return 'gitignore';

  return LANG_MAP[ext] || '';
}

/**
 * 재귀적으로 파일 목록 수집
 */
function collectFiles(dir, baseDir = dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        if (!shouldExcludeDir(entry.name)) {
          files.push(...collectFiles(fullPath, baseDir));
        }
      } else if (entry.isFile()) {
        if (shouldIncludeFile(fullPath)) {
          files.push({
            fullPath,
            relativePath,
            name: entry.name,
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
  }

  return files;
}

/**
 * 파일 내용 읽기
 */
function readFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (err) {
    return `// Error reading file: ${err.message}`;
  }
}

/**
 * 마크다운 생성
 */
function generateMarkdown(files, projectRoot) {
  const projectName = path.basename(projectRoot);
  const timestamp = new Date().toISOString();

  let markdown = `# ${projectName} - Complete Codebase

> Generated at: ${timestamp}
> Total files: ${files.length}

## Table of Contents

`;

  // 디렉토리별로 그룹화
  const filesByDir = {};
  for (const file of files) {
    const dir = path.dirname(file.relativePath) || '.';
    if (!filesByDir[dir]) {
      filesByDir[dir] = [];
    }
    filesByDir[dir].push(file);
  }

  // 목차 생성
  const sortedDirs = Object.keys(filesByDir).sort();
  for (const dir of sortedDirs) {
    const anchor = dir.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    markdown += `- [${dir}](#${anchor})\n`;
  }

  markdown += '\n---\n\n';

  // 파일 내용 추가
  for (const dir of sortedDirs) {
    const anchor = dir.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    markdown += `## ${dir}\n\n`;

    for (const file of filesByDir[dir]) {
      const lang = getLanguage(file.fullPath);
      const content = readFileContent(file.fullPath);

      markdown += `### ${file.name}\n\n`;
      markdown += `**Path:** \`${file.relativePath}\`\n\n`;
      markdown += `\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
    }

    markdown += '---\n\n';
  }

  return markdown;
}

/**
 * Dolphin 파일 브라우저로 디렉토리 열기
 */
function openWithDolphin(dirPath) {
  console.log(`\nOpening directory with Dolphin: ${dirPath}`);

  try {
    // dolphin을 백그라운드로 실행
    const child = spawn('dolphin', [dirPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    console.log('Dolphin opened successfully!');
  } catch (err) {
    console.error('Failed to open Dolphin:', err.message);
    console.log('You can manually open the directory at:', dirPath);
  }
}

/**
 * 메인 함수
 */
function main() {
  const projectRoot = __dirname;

  console.log('='.repeat(50));
  console.log('Codebase Export Tool');
  console.log('='.repeat(50));
  console.log(`\nProject root: ${projectRoot}`);

  // 출력 디렉토리 생성
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // 파일 수집
  console.log('\nCollecting files...');
  const files = collectFiles(projectRoot);
  console.log(`Found ${files.length} files to export.`);

  // 마크다운 생성
  console.log('\nGenerating markdown...');
  const markdown = generateMarkdown(files, projectRoot);

  // 파일 저장
  const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
  fs.writeFileSync(outputPath, markdown, 'utf-8');
  console.log(`\nMarkdown saved to: ${outputPath}`);

  // 파일 크기 표시
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`File size: ${sizeMB} MB`);

  // Dolphin으로 디렉토리 열기
  openWithDolphin(CONFIG.outputDir);

  console.log('\n' + '='.repeat(50));
  console.log('Export completed!');
  console.log('='.repeat(50));
}

// 실행
main();
