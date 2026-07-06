export type MarkdownHeading = {
  id: string;
  title: string;
  level: number;
};

const MAX_HEADING_TEXT_CHARS = 240;
const MAX_TOC_HEADINGS = 120;
const MAX_TOC_CONTENT_CHARS = 200_000;
const HEADING_CONTROL_PATTERN = /[\u0000-\u001F\u007F]+/g;

function normalizeInputText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function normalizeHeadingText(raw: string): string {
  return normalizeInputText(raw)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~]/g, '')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(HEADING_CONTROL_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_HEADING_TEXT_CHARS);
}

export function createHeadingSlug(raw: string): string {
  const normalized = normalizeHeadingText(raw)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'section';
}

export function buildMarkdownToc(
  content: string,
  postTitle?: string
): MarkdownHeading[] {
  const normalizedContent = normalizeInputText(content).slice(0, MAX_TOC_CONTENT_CHARS);
  if (!normalizedContent.trim()) return [];

  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: MarkdownHeading[] = [];
  const slugCounts = new Map<string, number>();

  const normalizedPostTitle = postTitle
    ? normalizeHeadingText(postTitle).toLowerCase()
    : '';
  let skippedTitleHeading = false;

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(normalizedContent)) !== null) {
    if (headings.length >= MAX_TOC_HEADINGS) break;

    const level = match[1].length;
    const rawTitle = match[2].trim();
    const title = normalizeHeadingText(rawTitle);
    if (!title) continue;

    if (
      normalizedPostTitle &&
      !skippedTitleHeading &&
      title.toLowerCase() === normalizedPostTitle
    ) {
      skippedTitleHeading = true;
      continue;
    }

    const baseSlug = createHeadingSlug(title);
    const currentCount = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, currentCount + 1);

    headings.push({
      id: currentCount === 0 ? baseSlug : `${baseSlug}-${currentCount}`,
      title,
      level,
    });
  }

  return headings;
}
