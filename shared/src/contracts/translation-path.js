/** Public post selectors, not filesystem paths. Decode only at the URL boundary. */
export function normalizeTranslationSlug(value, decode = true) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error('Invalid translation slug');
  let slug;
  try { slug = (decode ? decodeURIComponent(value) : value).trim().normalize('NFC'); }
  catch { throw new Error('Invalid translation slug encoding'); }
  if (!slug || slug.length > 255 || slug === '.' || slug === '..' || /[/\\?#%\u0000-\u001f\u007f]/u.test(slug)) {
    throw new Error('Invalid translation slug');
  }
  return slug;
}
export function normalizeTranslationSelectors(input, decode = true) {
  if (!input || typeof input.year !== 'string' || /[\u0000-\u001f\u007f]/u.test(input.year) || !/^\d{4}$/.test(input.year.trim())) {
    throw new Error('Invalid translation year');
  }
  if (typeof input.targetLang !== 'string' || /[\u0000-\u001f\u007f]/u.test(input.targetLang) || !['ko', 'en'].includes(input.targetLang.trim())) {
    throw new Error('Invalid translation target language');
  }
  return { year: input.year.trim(), slug: normalizeTranslationSlug(input.slug, decode), targetLang: input.targetLang.trim() };
}
export function translationUrls(origin, input, mode = 'public') {
  const selector = normalizeTranslationSelectors(input, false);
  const base = `${new URL(origin).origin}/api/v1`;
  const path = `${selector.year}/${encodeURIComponent(selector.slug)}/translations/${selector.targetLang}`;
  return {
    cacheUrl: `${base}/public/posts/${path}/cache`,
    statusUrl: mode === 'public' ? `${base}/public/posts/${path}/status` : `${base}/internal/posts/${path}/generate/status`,
    generateUrl: `${base}/internal/posts/${path}/generate`,
  };
}
export function normalizeTranslationJobId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(value)) throw new Error('Invalid translation job id');
  return value;
}
