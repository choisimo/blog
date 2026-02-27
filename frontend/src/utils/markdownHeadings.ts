export type MarkdownHeading = {
  id: string;
  title: string;
  level: number;
};

export function normalizeHeadingText(raw: string): string {
  return raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~]/g, '')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: MarkdownHeading[] = [];
  const slugCounts = new Map<string, number>();

  const normalizedPostTitle = postTitle
    ? normalizeHeadingText(postTitle).toLowerCase()
    : '';
  let skippedTitleHeading = false;

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
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
