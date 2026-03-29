// Utilities for building and parsing markdown with frontmatter
// Keep logic minimal & deterministic to mirror existing inline implementation
import matter from "gray-matter";

const FRONTMATTER_KEY_ORDER = [
  "title",
  "slug",
  "date",
  "description",
  "excerpt",
  "category",
  "tags",
  "coverImage",
  "published",
];

function orderFrontmatter(frontmatter) {
  const fm = frontmatter && typeof frontmatter === "object" ? frontmatter : {};
  const entries = Object.entries(fm).filter(([, value]) => value !== undefined);
  const ordered = [];

  for (const key of FRONTMATTER_KEY_ORDER) {
    const match = entries.find(([entryKey]) => entryKey === key);
    if (match) ordered.push(match);
  }

  const remaining = entries
    .filter(([key]) => !FRONTMATTER_KEY_ORDER.includes(key))
    .sort(([a], [b]) => a.localeCompare(b));

  return Object.fromEntries([...ordered, ...remaining]);
}

export function buildFrontmatterMarkdown(frontmatter, body) {
  const orderedFrontmatter = orderFrontmatter(frontmatter);
  const serialized = matter.stringify(body || "", orderedFrontmatter);
  return serialized.endsWith("\n") ? serialized : `${serialized}\n`;
}

export function parseMarkdown(raw) {
  const { data: frontmatter, content } = matter(raw);
  return { frontmatter, content, raw };
}
