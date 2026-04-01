// Utilities for building and parsing markdown with frontmatter
// Keep logic minimal & deterministic to mirror existing inline implementation
import matter from 'gray-matter';

export function buildFrontmatterMarkdown(frontmatter, body) {
  const fm = frontmatter || {};
  const serialized = Object.entries(fm)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}: [${v.map(x => JSON.stringify(x)).join(', ')}]`;
      }
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join('\n');
  return `---\n${serialized}\n---\n\n${body || ''}\n`;
}

export function parseMarkdown(raw) {
  const { data: frontmatter, content } = matter(raw);
  return { frontmatter, content, raw };
}
