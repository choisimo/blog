const EXTERNAL_URL_RE = /^(https?:)?\/\//i;
const NON_FILE_PROTOCOL_RE = /^(data|blob):/i;
const ROOT_IMAGES_RE = /^(?:\.\.\/|\.\/)*images\/(.+)$/i;
const ROOT_POSTS_RE = /^(?:\.\.\/|\.\/)*posts\/(.+)$/i;
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'];
const ANIMATED_IMAGE_EXTENSIONS = ['.gif'];

function trimMediaSrc(src: string): string {
  return src.trim();
}

function getMediaPathname(src: string): string {
  const raw = trimMediaSrc(src);
  if (!raw || NON_FILE_PROTOCOL_RE.test(raw)) return '';

  try {
    if (raw.startsWith('//')) {
      return new URL(`https:${raw}`).pathname.toLowerCase();
    }
    if (EXTERNAL_URL_RE.test(raw)) {
      return new URL(raw).pathname.toLowerCase();
    }
  } catch {
    return raw.replace(/[?#].*$/, '').toLowerCase();
  }

  return raw.replace(/[?#].*$/, '').toLowerCase();
}

function getPostYear(postPath?: string): string {
  const year = postPath?.split('/')[0] ?? '';
  return /^\d{4}$/.test(year) ? year : '';
}

function normalizeLegacyManifestPath(raw: string): string {
  if (/^\/posts\/\d{4}\/images\//i.test(raw)) {
    return raw.replace(/^\/posts\/\d{4}\//i, '/');
  }

  if (/^posts\/\d{4}\/images\//i.test(raw)) {
    return raw.replace(/^posts\/\d{4}\//i, '');
  }

  return raw;
}

export function isExternalMedia(src: string): boolean {
  const raw = trimMediaSrc(src);
  return EXTERNAL_URL_RE.test(raw) || raw.startsWith('//');
}

export function isVideoMedia(src: string): boolean {
  const pathname = getMediaPathname(src);
  return VIDEO_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

export function isAnimatedImageMedia(src: string): boolean {
  const pathname = getMediaPathname(src);
  return ANIMATED_IMAGE_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

export function normalizeManifestMediaPath(
  src?: string,
  postPath = '',
): string | undefined {
  if (typeof src !== 'string') return undefined;

  const raw = normalizeLegacyManifestPath(trimMediaSrc(src));
  if (!raw) return undefined;

  if (NON_FILE_PROTOCOL_RE.test(raw) || isExternalMedia(raw)) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return raw;
  }

  const rootImagesMatch = raw.match(ROOT_IMAGES_RE);
  if (rootImagesMatch?.[1]) {
    return `/images/${rootImagesMatch[1]}`;
  }

  const rootPostsMatch = raw.match(ROOT_POSTS_RE);
  if (rootPostsMatch?.[1]) {
    return `/posts/${rootPostsMatch[1]}`;
  }

  const year = getPostYear(postPath);
  const normalizedRelative = raw
    .replace(/^\.?\//, '')
    .replace(/^(?:\.\.\/)+/, '');

  if (year) {
    return `/posts/${year}/${normalizedRelative}`;
  }

  return `/${normalizedRelative}`;
}

export function resolvePostMediaSrc(src: string, postPath = ''): string {
  return normalizeManifestMediaPath(src, postPath) ?? src;
}

export function shouldUseThumb(src: string): boolean {
  const raw = trimMediaSrc(src);
  if (!raw) return false;
  if (NON_FILE_PROTOCOL_RE.test(raw)) return false;
  if (isVideoMedia(raw) || isAnimatedImageMedia(raw)) return false;
  if (raw.includes('.thumb.')) return false;

  const pathname = getMediaPathname(raw);
  return !!pathname;
}

export function getThumbSrc(src: string): string {
  if (!shouldUseThumb(src)) return src;

  const lastDot = src.lastIndexOf('.');
  if (lastDot === -1) return src;

  return `${src.substring(0, lastDot)}.thumb.webp`;
}
