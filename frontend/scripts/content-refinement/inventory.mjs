import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const root = fileURLToPath(new URL('../../public/posts/', import.meta.url));
const output = fileURLToPath(new URL('../../docs/content-refinement/inventory.json', import.meta.url));
const reviewed = JSON.parse(fs.readFileSync(new URL('../../docs/content-refinement/editorial-reviews.json', import.meta.url), 'utf8'));
const entries = [];
for (const year of fs.readdirSync(root).filter(name => /^\d{4}$/.test(name)).sort()) {
  for (const name of fs.readdirSync(path.join(root, year)).filter(name => name.endsWith('.md')).sort()) {
    const file = `${year}/${name}`;
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const { data, content } = matter(source);
    const hash = crypto.createHash('sha256').update(source).digest('hex');
    const fences = [...source.matchAll(/^```([^\n]*)\n([\s\S]*?)^```/gm)];
    const candidates = fences.flatMap((match, index) => {
      if (match[1] === 'diagram') return [];
      const isPlain = ['', 'text', 'plaintext'].includes(match[1].trim());
      const drawing = /[├└┌┐│┘┬┴]|[-=]{2,}>|[─━]{2,}|\+-{4,}\+/.test(match[2]);
      const other = isPlain && /→|←| -> | -- |^\s*\d+단계|^\w[^\n]*\/\n/m.test(match[2]);
      return drawing || other ? [{ block: index, line: source.slice(0, match.index).split('\n').length, language: match[1], sample: match[2].slice(0, 180) }] : [];
    });
    const prose = content.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
    const signals = [...new Set(prose.match(/살펴보겠습니다|알아보겠습니다|마무리하며|혁신적|획기적|여정|숨은 영웅|극대화|완벽히|솔직히|생각보다|핵심입니다|중요합니다|아키텍트의 시선/g) ?? [])];
    entries.push({ file, title: data.title, published: data.published !== false, sha256: hash,
      editorial: reviewed[file]?.sha256 === hash ? 'reviewed' : 'pending',
      editorialSignals: signals, diagramCount: fences.filter(match => match[1] === 'diagram').length,
      diagramCandidates: candidates });
  }
}
const report = { scope: 'All year-based Markdown posts, including drafts. Heuristic candidates require manual review; absence of signals does not prove completion.', total: entries.length, published: entries.filter(item => item.published).length, reviewed: entries.filter(item => item.editorial === 'reviewed').length, diagrams: entries.reduce((sum, item) => sum + item.diagramCount, 0), entries };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ total: report.total, published: report.published, reviewed: report.reviewed, diagrams: report.diagrams, candidateBlocks: entries.reduce((sum, item) => sum + item.diagramCandidates.length, 0) }));
