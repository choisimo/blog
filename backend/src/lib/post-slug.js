export function normalizePostSlug(value) {
  return String(value || 'post')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-\s_]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'post';
}
