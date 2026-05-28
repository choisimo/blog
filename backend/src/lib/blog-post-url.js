const BLOG_POST_YEAR_PATTERN = /^\d{4}$/;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildBlogPostPath(year, slug) {
  const normalizedYear = cleanText(year);
  const normalizedSlug = cleanText(slug).replace(/^\/+|\/+$/g, "");

  if (!BLOG_POST_YEAR_PATTERN.test(normalizedYear) || !normalizedSlug) {
    return undefined;
  }

  return `/blog/${normalizedYear}/${normalizedSlug}`;
}

export function canonicalizeBlogPostPath(input = {}) {
  const explicit = cleanText(input.url);
  if (explicit) {
    const legacyPostMatch = explicit.match(/^\/posts\/(\d{4})\/([^?#]+?)(?:\.md)?([?#].*)?$/);
    if (legacyPostMatch) {
      return `/blog/${legacyPostMatch[1]}/${legacyPostMatch[2]}${legacyPostMatch[3] || ""}`;
    }

    if (explicit.startsWith("/blog/") || /^[a-z][a-z\d+.-]*:/i.test(explicit)) {
      return explicit;
    }
  }

  return buildBlogPostPath(input.year, input.slug);
}
