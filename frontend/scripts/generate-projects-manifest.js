#!/usr/bin/env node
import matter from 'gray-matter';
import fs from 'fs';
import path from 'path';

const projectDataDir = path.join(process.cwd(), 'public', 'project-data');
const manifestPath = path.join(process.cwd(), 'public', 'projects-manifest.json');
const projectCatalogPath = path.join(process.cwd(), 'public', 'project-catalog.json');
const projectSummariesPath = path.join(process.cwd(), 'scripts', 'project-catalog-summaries.json');

const VALID_TYPES = new Set(['console', 'embed', 'link']);


function walkMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      results.push(fullPath);
    }
  }

  return results;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function quote(value) {
  return JSON.stringify(value);
}

function toRepositoryName(repository) {
  if (typeof repository !== 'string' || !repository.trim()) return null;
  const [, repoName] = repository.split('/');
  return repoName?.trim() || null;
}

function buildSeedProjectEntry(repo, summaries) {
  if (!repo || typeof repo !== 'object') return null;

  const repository = typeof repo.repository === 'string' ? repo.repository : '';
  const repoName = toRepositoryName(repository);
  const summary = repoName ? summaries?.[repoName] : null;
  const url = typeof repo.url === 'string' ? repo.url.trim() : '';
  if (!repoName || !summary?.description || !url) {
    return null;
  }

  const languages = Array.isArray(repo.languages)
    ? repo.languages
        .filter(item => typeof item === 'string' && item.trim())
        .map(item => item.trim())
    : [];
  const category =
    typeof summary.category === 'string' && summary.category.trim()
      ? summary.category.trim()
      : languages[0] || 'Web';
  const status = repo.isEmpty
    ? '빈 저장소'
    : repo.isArchived
      ? '보관'
      : repo.isFork
        ? '포크'
        : '공개';
  const tags = [...new Set([category, repo.isFork ? '포크' : '원본', ...languages])];
  const id = `choisimo--${repoName.toLowerCase()}`;
  const sourceUrl = typeof repo.sourceUrl === 'string' && repo.sourceUrl.trim() ? repo.sourceUrl.trim() : url;

  return {
    filename: `${id}.md`,
    frontmatter: {
      id,
      title: repoName,
      description: summary.description.trim(),
      date: typeof repo.pushedAt === 'string' && repo.pushedAt ? repo.pushedAt.slice(0, 10) : '1970-01-01',
      category,
      tags,
      stack: languages,
      status,
      type: 'link',
      url,
      codeUrl: sourceUrl,
      featured: false,
      published: true,
    },
    body: [
      `# ${repoName}`,
      '',
      summary.description.trim(),
      '',
      '## 확인한 저장소 정보',
      '',
      `- 저장소: [${repository}](${url})`,
      `- 구분: ${repo.isFork ? 'GitHub 포크 저장소' : 'GitHub 원본 저장소'}${repo.isEmpty ? ' · 커밋 없음' : ''}`,
      '- 공개 여부: PUBLIC',
      `- 보관 여부: ${repo.isArchived ? '보관됨' : '보관되지 않음'}`,
      `- 최근 푸시 (GitHub pushedAt): ${repo.pushedAt ?? '알 수 없음'}`,
      `- 주요 언어: ${languages.join(', ') || '감지된 언어 없음'}`,
      repo.sourceUrl ? `- 검토 기준 소스: [바로가기](${repo.sourceUrl})` : null,
      '',
      '이 항목은 공개 저장소 메타데이터와 검토된 프로젝트 요약을 바탕으로 자동 정리했습니다.',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function serializeSeedMarkdown(entry) {
  return `---\n${Object.entries(entry.frontmatter)
    .map(([key, value]) => `${key}: ${quote(value)}`)
    .join('\n')}\n---\n\n${entry.body}\n`;
}

function ensureSeedProjectData() {
  fs.mkdirSync(projectDataDir, { recursive: true });
  const existingMarkdownFiles = walkMarkdownFiles(projectDataDir);
  if (existingMarkdownFiles.length > 0) {
    return existingMarkdownFiles;
  }

  const catalog = readJsonIfExists(projectCatalogPath);
  const summaries = readJsonIfExists(projectSummariesPath);
  const repositories = Array.isArray(catalog?.repositories) ? catalog.repositories : [];
  const seedEntries = repositories
    .map(repo => buildSeedProjectEntry(repo, summaries || {}))
    .filter(Boolean);

  if (!seedEntries.length) {
    return [];
  }

  for (const entry of seedEntries) {
    const targetPath = path.join(projectDataDir, entry.filename);
    fs.writeFileSync(targetPath, serializeSeedMarkdown(entry));
  }

  console.log(`ℹ️  Seeded ${seedEntries.length} project Markdown files from the verified project catalog.`);
  return walkMarkdownFiles(projectDataDir);
}

function normalizeImagePath(rawPath, markdownAbsPath) {
  if (!rawPath || typeof rawPath !== 'string') return undefined;
  if (/^https?:\/\//i.test(rawPath) || rawPath.startsWith('data:')) {
    return rawPath;
  }

  if (rawPath.startsWith('/')) return rawPath;

  const markdownDir = path.dirname(markdownAbsPath);
  const absolutePath = path.resolve(markdownDir, rawPath);
  const publicDir = path.join(process.cwd(), 'public');
  const relativeToPublic = path.relative(publicDir, absolutePath);

  if (relativeToPublic && !relativeToPublic.startsWith('..')) {
    return `/${relativeToPublic.replace(/\\/g, '/')}`;
  }

  return `/${rawPath.replace(/^\.?\//, '')}`;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function toSafeDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return new Date().toISOString().slice(0, 10);
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    if (Number.isNaN(fromNumber.getTime())) return new Date().toISOString().slice(0, 10);
    return fromNumber.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string' || !value.trim()) {
    return new Date().toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function stripMarkdown(content) {
  return content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeType(value) {
  if (typeof value !== 'string') return 'link';
  const normalized = value.trim().toLowerCase();
  return VALID_TYPES.has(normalized) ? normalized : 'link';
}

function normalizeStatus(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Dev';
  return value.trim();
}

function parseProjectFile(absPath) {
  const source = fs.readFileSync(absPath, 'utf8');
  const { data: fm, content } = matter(source);
  const filename = path.basename(absPath, '.md');
  const slug = typeof fm.slug === 'string' && fm.slug.trim() ? fm.slug.trim() : filename;
  const id = typeof fm.id === 'string' && fm.id.trim() ? fm.id.trim() : slug;
  const title = typeof fm.title === 'string' && fm.title.trim()
    ? fm.title.trim()
    : slug.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  const bodyText = stripMarkdown(content);
  const description = typeof fm.description === 'string' && fm.description.trim()
    ? fm.description.trim()
    : bodyText.slice(0, 180);

  const url = typeof fm.url === 'string' && fm.url.trim()
    ? fm.url.trim()
    : typeof fm.link === 'string' && fm.link.trim()
      ? fm.link.trim()
      : '';

  if (!url) {
    console.warn(`⚠️  Skipped project (missing url): ${path.relative(process.cwd(), absPath)}`);
    return null;
  }

  const thumbnailRaw = typeof fm.thumbnail === 'string' ? fm.thumbnail : fm.coverImage;

  return {
    id,
    slug,
    title,
    description: description || 'No description provided.',
    date: toSafeDate(fm.date),
    category: typeof fm.category === 'string' && fm.category.trim() ? fm.category.trim() : 'Web',
    tags: toStringArray(fm.tags),
    stack: toStringArray(fm.stack),
    status: normalizeStatus(fm.status),
    type: normalizeType(fm.type),
    url,
    codeUrl: typeof fm.codeUrl === 'string' && fm.codeUrl.trim() ? fm.codeUrl.trim() : undefined,
    thumbnail: normalizeImagePath(thumbnailRaw, absPath),
    featured: toBoolean(fm.featured),
    published: fm.published !== false,
  };
}

function sortProjects(items) {
  return items.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

function writeManifest(items) {
  const manifest = {
    total: items.length,
    items,
    generatedAt: new Date().toISOString(),
    format: 1,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  console.log('🚀 Generating projects manifest...');

  const markdownFiles = ensureSeedProjectData();
  const parsed = markdownFiles
    .map(parseProjectFile)
    .filter(item => item !== null && item.published !== false)
    .map(({ published, slug, ...rest }) => rest);

  const sortedItems = sortProjects(parsed);
  if (!sortedItems.length) {
    throw new Error('No published project entries were generated. Refusing to write an empty projects manifest.');
  }

  writeManifest(sortedItems);

  console.log(`✅ Wrote projects manifest: ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`   - Source markdown files: ${markdownFiles.length}`);
  console.log(`   - Published projects: ${sortedItems.length}`);
}

try {
  main();
} catch (error) {
  console.error('❌ Failed to generate projects manifest:', error);
  process.exit(1);
}
