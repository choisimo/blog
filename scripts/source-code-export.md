# Source Code Export

- Root: `/home/nodove/workspace/blog/scripts`
- Generated at: `2026-03-22T06:11:49.694Z`
- Files: `4`

## File List

- `__tests__/export-source-to-markdown.test.js`
- `deploy-backend.rs`
- `export-source-to-markdown.js`
- `organize-images.sh`

## __tests__/export-source-to-markdown.test.js

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  shouldExcludePath,
  walk,
} = require('../export-source-to-markdown.js');

function writeFile(rootDir, relativePath, content = 'export const value = 1;\n') {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
}

test('shouldExcludePath blocks env files and generated public artifacts', () => {
  assert.equal(shouldExcludePath('.env'), true);
  assert.equal(shouldExcludePath('.env.production'), true);
  assert.equal(shouldExcludePath('frontend/public/blog/2026/example.html'), true);
  assert.equal(shouldExcludePath('frontend/public/post/example.html'), true);
  assert.equal(shouldExcludePath('frontend/public/posts-manifest.json'), true);
  assert.equal(shouldExcludePath('frontend/public/projects-manifest.json'), true);
  assert.equal(shouldExcludePath('frontend/public/sitemap.xml'), true);
  assert.equal(shouldExcludePath('frontend/src/app.ts'), false);
});

test('walk excludes temp, evidence, and generated paths while keeping source files', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-export-'));

  try {
    writeFile(rootDir, 'frontend/src/App.tsx', 'export const App = () => null;\n');
    writeFile(rootDir, '.tmp/api-keys-capture.mjs', 'const secret = "nope";\n');
    writeFile(rootDir, '.evidence/screenshot.js', 'const image = true;\n');
    writeFile(rootDir, '.sisyphus/notes.js', 'const note = true;\n');
    writeFile(rootDir, 'frontend/public/blog/2026/generated.html', '<html></html>\n');
    writeFile(rootDir, 'frontend/public/post/generated.html', '<html></html>\n');
    writeFile(rootDir, 'frontend/public/posts-manifest.json', '{"items":[]}\n');
    writeFile(rootDir, 'frontend/public/sitemap.xml', '<xml />\n');
    writeFile(rootDir, '.env.local', 'API_KEY=secret\n');

    const collected = [];
    walk(rootDir, rootDir, collected, 1024 * 1024);
    collected.sort();

    assert.deepEqual(collected, ['frontend/src/App.tsx']);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

```

## deploy-backend.rs

```rust
use std::env;
use std::error::Error;
use std::process::{Command, Stdio};

#[derive(Debug, Clone)]
struct Config {
    host: String,
    repo_dir: String,
    backend_dir: String,
    branch: String,
    services: Vec<String>,
    health_url: String,
    dry_run: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: "blog".to_string(),
            repo_dir: "/home/nodove/workspace/blog".to_string(),
            backend_dir: "/home/nodove/workspace/blog/backend".to_string(),
            branch: "main".to_string(),
            services: vec![
                "api".to_string(),
                "terminal-server".to_string(),
                "redis".to_string(),
            ],
            health_url: "http://127.0.0.1:5080/api/v1/healthz".to_string(),
            dry_run: false,
        }
    }
}

impl Config {
    fn from_args() -> Result<Self, Box<dyn Error>> {
        let mut cfg = Self::default();
        let mut args = env::args().skip(1);

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--host" => cfg.host = next_arg(&mut args, "--host")?,
                "--repo-dir" => cfg.repo_dir = next_arg(&mut args, "--repo-dir")?,
                "--backend-dir" => cfg.backend_dir = next_arg(&mut args, "--backend-dir")?,
                "--branch" => cfg.branch = next_arg(&mut args, "--branch")?,
                "--services" => {
                    cfg.services = next_arg(&mut args, "--services")?
                        .split(',')
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .map(ToString::to_string)
                        .collect();
                }
                "--health-url" => cfg.health_url = next_arg(&mut args, "--health-url")?,
                "--dry-run" => cfg.dry_run = true,
                "-h" | "--help" => {
                    print_help();
                    std::process::exit(0);
                }
                _ => return Err(format!("Unknown argument: {arg}").into()),
            }
        }

        if cfg.services.is_empty() {
            return Err("services list must not be empty".into());
        }

        Ok(cfg)
    }
}

fn next_arg(args: &mut impl Iterator<Item = String>, flag: &str) -> Result<String, Box<dyn Error>> {
    args.next()
        .ok_or_else(|| format!("{flag} requires a value").into())
}

fn shell_quote(input: &str) -> String {
    format!("'{}'", input.replace('\'', "'\"'\"'"))
}

fn run_ssh(host: &str, script: &str) -> Result<String, Box<dyn Error>> {
    let remote_command = format!("bash -lc {}", shell_quote(script));
    let output = Command::new("ssh")
        .arg(host)
        .arg(remote_command)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        let mut msg = format!(
            "remote command failed (host={host}, exit={})",
            output.status.code().unwrap_or(-1)
        );
        if !stdout.trim().is_empty() {
            msg.push_str(&format!("\nstdout:\n{stdout}"));
        }
        if !stderr.trim().is_empty() {
            msg.push_str(&format!("\nstderr:\n{stderr}"));
        }
        return Err(msg.into());
    }

    if !stderr.trim().is_empty() {
        eprintln!("[ssh:{host}] {stderr}");
    }

    Ok(stdout)
}

fn print_help() {
    println!(
        r#"Backend deploy script (ssh blog)

Usage:
  rustc --edition=2021 scripts/deploy-backend.rs -o deploy-backend
  ./deploy-backend [options]

Options:
  --host <ssh-host>        SSH host alias (default: blog)
  --repo-dir <path>        Remote repository path (default: /home/nodove/workspace/blog)
  --backend-dir <path>     Remote backend path (default: /home/nodove/workspace/blog/backend)
  --branch <name>          Branch to pull (default: main)
  --services <csv>         docker-compose services (default: api,terminal-server,redis)
  --health-url <url>       Health URL (default: http://127.0.0.1:5080/api/v1/healthz)
  --dry-run                Print remote commands only
  -h, --help               Show help
"#
    );
}

fn main() -> Result<(), Box<dyn Error>> {
    let cfg = Config::from_args()?;
    let service_args = cfg.services.join(" ");

    let git_script = format!(
        r#"set -euo pipefail
cd {}
git pull --ff-only origin {}
git rev-parse --short HEAD
"#,
        shell_quote(&cfg.repo_dir),
        shell_quote(&cfg.branch),
    );

    let deploy_script = format!(
        r#"set -euo pipefail
cd {}
docker-compose up -d {}
docker-compose ps {}
"#,
        shell_quote(&cfg.backend_dir),
        service_args,
        service_args,
    );

    let health_script = format!(
        r#"set -euo pipefail
if command -v curl >/dev/null 2>&1; then
  curl -fsSL {}
else
  wget -qO- {}
fi
"#,
        shell_quote(&cfg.health_url),
        shell_quote(&cfg.health_url),
    );

    println!("== Remote Backend Deploy ==");
    println!("host        : {}", cfg.host);
    println!("repo_dir    : {}", cfg.repo_dir);
    println!("backend_dir : {}", cfg.backend_dir);
    println!("branch      : {}", cfg.branch);
    println!("services    : {}", cfg.services.join(","));
    println!("health_url  : {}", cfg.health_url);
    println!("dry_run     : {}", cfg.dry_run);

    if cfg.dry_run {
        println!("\n[dry-run] git script:\n{git_script}");
        println!("\n[dry-run] deploy script:\n{deploy_script}");
        println!("\n[dry-run] health script:\n{health_script}");
        return Ok(());
    }

    println!("\n1) Pull latest code");
    let commit = run_ssh(&cfg.host, &git_script)?;
    println!("   deployed commit: {}", commit.trim());

    println!("2) Restart backend containers");
    let deploy_out = run_ssh(&cfg.host, &deploy_script)?;
    if !deploy_out.trim().is_empty() {
        println!("{deploy_out}");
    }

    println!("3) Health check");
    let health_out = run_ssh(&cfg.host, &health_script)?;
    println!("   {}", health_out.trim());

    println!("\nDeployment finished.");
    Ok(())
}

```

## export-source-to-markdown.js

```js
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
  '.tmp',
  '.evidence',
  '.sisyphus',
  'test-results',
  'verification-screenshots',
]);

const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  '.DS_Store',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.env.staging',
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
]);

const EXCLUDED_PATH_PATTERNS = [
  /^frontend\/public\/blog\//,
  /^frontend\/public\/post\//,
  /^frontend\/public\/posts-manifest\.json$/,
  /^frontend\/public\/projects-manifest\.json$/,
  /^frontend\/public\/(?:sitemap|rss|robots)\.xml$/,
];

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

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function shouldExcludePath(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const fileName = path.basename(normalizedPath);

  if (/^\.env(\..+)?$/.test(fileName)) {
    return true;
  }

  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}

function shouldIncludeFile(filePath, stat, maxFileSize) {
  if (!stat.isFile()) {
    return false;
  }

  const fileName = path.basename(filePath);
  if (EXCLUDED_FILES.has(fileName)) {
    return false;
  }

  // Exclude all .env* files (e.g. .env.local, .env.production) to prevent secret leaks.
  if (/^\.env(\..+)?$/.test(fileName)) {
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

if (require.main === module) {
  main();
}

module.exports = {
  EXCLUDED_DIRS,
  EXCLUDED_FILES,
  EXCLUDED_PATH_PATTERNS,
  INCLUDED_EXTENSIONS,
  parseArgs,
  printHelp,
  normalizeRelativePath,
  shouldExcludePath,
  shouldIncludeFile,
  walk,
  detectLanguage,
  buildMarkdown,
  main,
};

```

## organize-images.sh

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
POSTS_DIR="$PROJECT_ROOT/frontend/public/posts"
IMAGES_DIR="$PROJECT_ROOT/frontend/public/images"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MOVED_COUNT=0
UPDATED_COUNT=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Image Organization Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

update_markdown_references() {
    local post_file="$1"
    local img_name="$2"
    local new_image_path="$3"
    local old_path="$4"
    
    local temp_file
    temp_file=$(mktemp)
    local changed=false
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        local new_line="$line"
        
        if [[ "$new_line" == *"$img_name"* ]] && [[ "$new_line" == *"!["* ]]; then
            if [[ "$new_line" == *"/images/"*"$img_name"* ]]; then
                :
            elif [[ -n "$old_path" ]] && [[ "$new_line" == *"($old_path)"* ]]; then
                new_line="${new_line//"($old_path)"/"(/images/$new_image_path/$img_name)"}"
                changed=true
            elif [[ "$new_line" == *"($img_name)"* ]]; then
                new_line="${new_line//"($img_name)"/"(/images/$new_image_path/$img_name)"}"
                changed=true
            elif [[ "$new_line" == *"(./$img_name)"* ]]; then
                new_line="${new_line//"(./$img_name)"/"(/images/$new_image_path/$img_name)"}"
                changed=true
            fi
        fi
        
        echo "$new_line" >> "$temp_file"
    done < "$post_file"
    
    if [[ "$changed" == true ]]; then
        mv "$temp_file" "$post_file"
        echo -e "${BLUE}    Updated references in: $(basename "$post_file")${NC}"
        UPDATED_COUNT=$((UPDATED_COUNT + 1))
    else
        rm -f "$temp_file"
    fi
}

process_year_directory() {
    local year_dir="$1"
    local year_name
    year_name=$(basename "$year_dir")
    
    if [[ ! "$year_name" =~ ^[0-9]{4}$ ]]; then
        return 0
    fi
    
    local lang_prefix=""
    if [[ "$year_dir" =~ /posts/(ko|en)/ ]]; then
        lang_prefix=$(echo "$year_dir" | grep -oP '/posts/\K(ko|en)(?=/)' || echo "")
        if [[ -n "$lang_prefix" ]]; then
            lang_prefix="${lang_prefix}/"
        fi
    fi

    local image_subdir="$year_dir/image"
    if [[ -d "$image_subdir" ]]; then
        echo -e "${BLUE}Processing: $year_dir/image/${NC}"
        
        for post_img_dir in "$image_subdir"/*/; do
            if [[ -d "$post_img_dir" ]]; then
                local post_name
                post_name=$(basename "$post_img_dir")
                local matching_post="$year_dir/${post_name}.md"
                
                if [[ ! -f "$matching_post" ]]; then
                    echo -e "${YELLOW}  Skip (no matching post): $post_name${NC}"
                    continue
                fi
                
                local target_image_dir="$IMAGES_DIR/${lang_prefix}${year_name}/${post_name}"
                mkdir -p "$target_image_dir"
                
                shopt -s nullglob
                local img_files=("$post_img_dir"/*.png "$post_img_dir"/*.jpg "$post_img_dir"/*.jpeg "$post_img_dir"/*.gif "$post_img_dir"/*.webp "$post_img_dir"/*.svg "$post_img_dir"/*.PNG "$post_img_dir"/*.JPG "$post_img_dir"/*.JPEG "$post_img_dir"/*.GIF "$post_img_dir"/*.WEBP "$post_img_dir"/*.SVG)
                shopt -u nullglob
                
                for img_file in "${img_files[@]}"; do
                    if [[ -f "$img_file" ]]; then
                        local img_name
                        img_name=$(basename "$img_file")
                        
                        if [[ ! -f "$target_image_dir/$img_name" ]]; then
                            mv "$img_file" "$target_image_dir/"
                            echo -e "${GREEN}  Moved: image/$post_name/$img_name -> images/${lang_prefix}${year_name}/${post_name}/${NC}"
                            MOVED_COUNT=$((MOVED_COUNT + 1))
                            
                            local old_ref="image/${post_name}/${img_name}"
                            update_markdown_references "$matching_post" "$img_name" "${lang_prefix}${year_name}/${post_name}" "$old_ref"
                        else
                            echo -e "${YELLOW}  Skip (exists): $img_name${NC}"
                            rm -f "$img_file"
                        fi
                    fi
                done
                
                rmdir "$post_img_dir" 2>/dev/null || true
            fi
        done
        
        rmdir "$image_subdir" 2>/dev/null || true
    fi

    shopt -s nullglob
    local img_files=("$year_dir"/*.png "$year_dir"/*.jpg "$year_dir"/*.jpeg "$year_dir"/*.gif "$year_dir"/*.webp "$year_dir"/*.svg "$year_dir"/*.PNG "$year_dir"/*.JPG "$year_dir"/*.JPEG "$year_dir"/*.GIF "$year_dir"/*.WEBP "$year_dir"/*.SVG)
    shopt -u nullglob
    
    for img_file in "${img_files[@]}"; do
        if [[ -f "$img_file" ]]; then
            local img_name
            img_name=$(basename "$img_file")
            
            local ref_post=""
            shopt -s nullglob
            local md_files=("$year_dir"/*.md)
            shopt -u nullglob
            
            for md_file in "${md_files[@]}"; do
                if [[ "$(basename "$md_file")" == "_index.md" ]]; then
                    continue
                fi
                if grep -q "$img_name" "$md_file" 2>/dev/null; then
                    ref_post="$md_file"
                    break
                fi
            done
            
            if [[ -z "$ref_post" ]]; then
                echo -e "${YELLOW}  Skip (no reference found): $img_name${NC}"
                continue
            fi
            
            local post_name
            post_name=$(basename "$ref_post" .md)
            local target_image_dir="$IMAGES_DIR/${lang_prefix}${year_name}/${post_name}"
            
            mkdir -p "$target_image_dir"
            
            if [[ ! -f "$target_image_dir/$img_name" ]]; then
                mv "$img_file" "$target_image_dir/"
                echo -e "${GREEN}  Moved: $img_name -> images/${lang_prefix}${year_name}/${post_name}/${NC}"
                MOVED_COUNT=$((MOVED_COUNT + 1))
                
                update_markdown_references "$ref_post" "$img_name" "${lang_prefix}${year_name}/${post_name}" "$img_name"
            else
                echo -e "${YELLOW}  Skip (exists): $img_name${NC}"
                rm -f "$img_file"
            fi
        fi
    done

    shopt -s nullglob
    local subdirs=("$year_dir"/*/)
    shopt -u nullglob
    
    for subdir in "${subdirs[@]}"; do
        if [[ -d "$subdir" ]]; then
            local subdir_name
            subdir_name=$(basename "$subdir")
            
            if [[ "$subdir_name" == "image" ]] || [[ "$subdir_name" =~ ^[0-9]{4}$ ]] || [[ "$subdir_name" == "ko" ]] || [[ "$subdir_name" == "en" ]]; then
                continue
            fi
            
            local matching_post="$year_dir/${subdir_name}.md"
            if [[ ! -f "$matching_post" ]]; then
                continue
            fi
            
            local post_name="$subdir_name"
            local target_image_dir="$IMAGES_DIR/${lang_prefix}${year_name}/${post_name}"
            
            shopt -s nullglob
            local subdir_imgs=("$subdir"/*.png "$subdir"/*.jpg "$subdir"/*.jpeg "$subdir"/*.gif "$subdir"/*.webp "$subdir"/*.svg "$subdir"/*.PNG "$subdir"/*.JPG "$subdir"/*.JPEG "$subdir"/*.GIF "$subdir"/*.WEBP "$subdir"/*.SVG)
            shopt -u nullglob
            
            for img_file in "${subdir_imgs[@]}"; do
                if [[ -f "$img_file" ]]; then
                    local img_name
                    img_name=$(basename "$img_file")
                    
                    mkdir -p "$target_image_dir"
                    
                    if [[ ! -f "$target_image_dir/$img_name" ]]; then
                        mv "$img_file" "$target_image_dir/"
                        echo -e "${GREEN}  Moved: $subdir_name/$img_name -> images/${lang_prefix}${year_name}/${post_name}/${NC}"
                        MOVED_COUNT=$((MOVED_COUNT + 1))
                        
                        local old_ref="${subdir_name}/${img_name}"
                        update_markdown_references "$matching_post" "$img_name" "${lang_prefix}${year_name}/${post_name}" "$old_ref"
                    fi
                fi
            done
            
            rmdir "$subdir" 2>/dev/null || true
        fi
    done
}

echo -e "${BLUE}Scanning posts directory...${NC}"
echo ""

for year_dir in "$POSTS_DIR"/*/; do
    if [[ -d "$year_dir" ]]; then
        local_dir_name=$(basename "$year_dir")
        if [[ "$local_dir_name" =~ ^[0-9]{4}$ ]]; then
            process_year_directory "$year_dir"
        elif [[ "$local_dir_name" == "ko" ]] || [[ "$local_dir_name" == "en" ]]; then
            for lang_year_dir in "$year_dir"*/; do
                if [[ -d "$lang_year_dir" ]]; then
                    process_year_directory "$lang_year_dir"
                fi
            done
        fi
    fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  Images moved: ${MOVED_COUNT}"
echo -e "  Files updated: ${UPDATED_COUNT}"
echo ""

```
