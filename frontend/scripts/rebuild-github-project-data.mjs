#!/usr/bin/env node
// Rebuild only the Projects catalog from a reviewed, pinned GitHub evidence bundle.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.argv[2] && path.resolve(process.argv[2]);
const checkOnly = process.argv.includes('--check');
if (!dataDir || dataDir.startsWith('--')) {
  throw new Error('Usage: node scripts/rebuild-github-project-data.mjs <evidence-data-directory> [--check]');
}

const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const inventory = readJSON(path.join(dataDir, 'repositories.json'));
const evidence = readJSON(path.join(dataDir, 'evidence.json'));
const summaries = readJSON(path.join(frontendDir, 'scripts/project-catalog-summaries.json'));
const publicRepos = inventory.filter(repo => repo.nameWithOwner.startsWith('choisimo/')
  && repo.isPrivate === false && repo.visibility === 'PUBLIC');
if (!publicRepos.length || new Set(publicRepos.map(repo => repo.nameWithOwner)).size !== publicRepos.length) {
  throw new Error('The public repository inventory is empty or contains duplicates.');
}
const evidenceByName = new Map(evidence.map(item => [item.repository, item]));
const expectedNames = new Set(publicRepos.map(repo => repo.name));
if (Object.keys(summaries).some(name => !expectedNames.has(name))) {
  throw new Error('Remove summaries for repositories outside the current public inventory before publishing.');
}

const quote = value => JSON.stringify(value);
const entries = publicRepos.map(repo => {
  const summary = summaries[repo.name];
  const proof = evidenceByName.get(repo.nameWithOwner);
  if (!summary?.description || !summary?.category || !proof?.checkedAt
    || !['ok', 'empty'].includes(proof.commitStatus)
    || (proof.commitStatus === 'ok' && (proof.rootStatus !== 'ok' || !['ok', 'missing'].includes(proof.readmeStatus)))) {
    throw new Error(`Missing reviewed summary or complete evidence: ${repo.nameWithOwner}`);
  }
  if (!repo.isEmpty && !/^[0-9a-f]{40}$/.test(proof.head ?? '')) {
    throw new Error(`Missing pinned commit: ${repo.nameWithOwner}`);
  }
  const languages = repo.primaryLanguage?.name ? [repo.primaryLanguage.name] : [];
  const status = repo.isEmpty ? '빈 저장소' : repo.isArchived ? '보관' : repo.isFork ? '포크' : '공개';
  const tags = [...new Set([summary.category, repo.isFork ? '포크' : '원본', ...languages])];
  const id = `choisimo--${repo.name.toLowerCase()}`;
  const sourceUrl = proof.head ? `${repo.url}/tree/${proof.head}` : repo.url;
  const project = {
    id, title: repo.name, description: summary.description,
    date: repo.pushedAt.slice(0, 10), category: summary.category, tags, stack: languages,
    status, type: 'link', url: repo.url, codeUrl: sourceUrl, featured: false, published: true,
  };
  const source = {
    repository: repo.nameWithOwner, url: repo.url, sourceUrl,
    isFork: repo.isFork, isArchived: repo.isArchived, isEmpty: repo.isEmpty,
    pushedAt: repo.pushedAt, checkedAt: proof.checkedAt,
    head: proof.head ?? null, readmeStatus: proof.readmeStatus, languages,
  };
  const markdown = `---\n${Object.entries(project).map(([key, value]) => `${key}: ${quote(value)}`).join('\n')}\n---\n\n# ${repo.name}\n\n${summary.description}\n\n## 확인한 저장소 정보\n\n- 저장소: [${repo.nameWithOwner}](${repo.url})\n- 구분: ${repo.isFork ? 'GitHub 포크 저장소' : 'GitHub 원본 저장소'}${repo.isEmpty ? ' · 커밋 없음' : ''}\n- 공개 여부: PUBLIC\n- 보관 여부: ${repo.isArchived ? '보관됨' : '보관되지 않음'}\n- 생성: ${repo.createdAt}\n- 최근 푸시 (GitHub pushedAt): ${repo.pushedAt}\n- 주요 언어 (GitHub primaryLanguage): ${languages.join(', ') || '감지된 언어 없음'}\n- 확인 일시: ${proof.checkedAt}\n${proof.head ? `- 검토 기준 커밋: [${proof.head}](${sourceUrl})\n` : ''}- 루트 README: ${proof.readmeStatus === 'ok' ? '확인함' : repo.isEmpty ? '커밋 없음' : '없음'}\n\n저장소의 공개 메타데이터와 위 커밋의 README·루트 구성을 근거로 작성했습니다. 푸시 날짜는 기본 브랜치의 커밋 날짜와 다를 수 있습니다. 공개 여부는 운영 서비스의 가동·완료 상태를 뜻하지 않습니다.${repo.isFork ? ' 포크 여부는 GitHub 메타데이터 기준이며 원저작·기여 실적으로 합산하지 않습니다.' : ''}\n`;
  return { filename: `${id}.md`, markdown, project, source };
});

const projectDataDir = path.join(frontendDir, 'public/project-data');
const markdownFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const fullPath = path.join(directory, entry.name);
  return entry.isDirectory() ? markdownFiles(fullPath) : entry.name.endsWith('.md') ? [fullPath] : [];
});
const currentFiles = fs.existsSync(projectDataDir) ? markdownFiles(projectDataDir) : [];
const catalog = {
  account: 'choisimo', checkedAt: entries.map(entry => entry.source.checkedAt).sort().at(-1),
  source: 'gh repo list choisimo --limit 1000 --json ...; gh api pinned default-branch README and root contents',
  scope: 'All public repositories, including forks and empty repositories. Private repositories and other accounts are excluded.',
  counts: { public: entries.length, original: publicRepos.filter(repo => !repo.isFork).length,
    forks: publicRepos.filter(repo => repo.isFork).length, empty: publicRepos.filter(repo => repo.isEmpty).length },
  repositories: entries.map(entry => entry.source),
};
const catalogPath = path.join(frontendDir, 'public/project-catalog.json');

if (checkOnly) {
  if (currentFiles.length !== entries.length) throw new Error('Project Markdown count differs from the public inventory.');
  for (const entry of entries) {
    const target = path.join(projectDataDir, entry.filename);
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== entry.markdown) {
      throw new Error(`Project source differs from reviewed evidence: ${entry.filename}`);
    }
    const parsed = matter(fs.readFileSync(target, 'utf8')).data;
    if (JSON.stringify(parsed) !== JSON.stringify(entry.project)) throw new Error(`Frontmatter changed meaning: ${entry.filename}`);
  }
  if (JSON.stringify(readJSON(catalogPath)) !== JSON.stringify(catalog)) throw new Error('Public provenance catalog is stale.');
  const manifest = readJSON(path.join(frontendDir, 'public/projects-manifest.json'));
  if (manifest.total !== entries.length || manifest.items.length !== entries.length
    || new Set(manifest.items.map(item => item.id)).size !== entries.length) throw new Error('Manifest has missing or duplicate entries.');
  for (const entry of entries) {
    const item = manifest.items.find(item => item.id === entry.project.id);
    const { published, ...expected } = entry.project;
    if (!item || Object.entries(expected).some(([key, value]) => JSON.stringify(item[key]) !== JSON.stringify(value))) {
      throw new Error(`Manifest differs from verified source: ${entry.filename}`);
    }
  }
  console.log(`Verified all ${entries.length} public repositories: ${catalog.counts.original} originals, ${catalog.counts.forks} forks, ${catalog.counts.empty} empty. No missing, extra or duplicate project entries.`);
} else {
  // The user requested a full catalog replacement. Validate every entry before removing old Markdown.
  fs.mkdirSync(projectDataDir, { recursive: true });
  for (const file of currentFiles) fs.unlinkSync(file);
  for (const entry of entries) fs.writeFileSync(path.join(projectDataDir, entry.filename), entry.markdown);
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Replaced ${currentFiles.length} project sources with ${entries.length} reviewed public repository entries. Run npm run generate-projects-manifest next.`);
}
