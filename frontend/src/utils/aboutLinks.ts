const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasUnsafeHrefChars(value: string): boolean {
  return /[\u0000-\u001F\u007F\s]/.test(value);
}

export function normalizeAboutSocialHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const candidate = value.trim();
  if (!candidate || hasUnsafeHrefChars(candidate) || candidate.startsWith('//')) {
    return null;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function normalizeAboutEmailHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const email = value.trim();
  if (!email || hasUnsafeHrefChars(email) || !EMAIL_PATTERN.test(email)) {
    return null;
  }

  return `mailto:${email}`;
}
