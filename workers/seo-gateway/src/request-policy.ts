import type { Env } from './types';

export class SeoGatewayError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = 'SeoGatewayError';
  }
}

// URL.pathname is percent-encoded. Decode each segment once, not the whole path.
// NFC preserves spelling while making composed/decomposed Unicode comparable.
export function decodePathSegment(segment: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment).normalize('NFC');
  } catch {
    throw new SeoGatewayError(400, 'INVALID_PATH');
  }
  if (
    !decoded || decoded === '.' || decoded === '..' ||
    /[\\/?#%\u0000-\u001f\u007f-\u009f]/u.test(decoded)
  ) {
    throw new SeoGatewayError(400, 'INVALID_PATH');
  }
  return decoded;
}

export function normalizeRequestPath(pathname: string): string {
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('//')) {
    throw new SeoGatewayError(400, 'INVALID_PATH');
  }
  const segments = pathname.split('/');
  return segments.map((part, index) => {
    if (!part && (index === 0 || index === segments.length - 1)) return '';
    return encodeURIComponent(decodePathSegment(part));
  }).join('/');
}

// Manifest slugs are already decoded; never percent-decode them a second time.
export function normalizeManifestSlug(slug: string): string {
  const normalized = slug.normalize('NFC');
  if (!normalized || normalized === '.' || normalized === '..' ||
      /[\\/?#%\u0000-\u001f\u007f-\u009f]/u.test(normalized)) {
    throw new SeoGatewayError(502, 'INVALID_MANIFEST');
  }
  return normalized;
}

export function configuredOrigin(value: string | undefined): string {
  try {
    const url = new URL(value || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('Invalid origin');
    }
    return url.href.replace(/\/+$/, '');
  } catch {
    throw new SeoGatewayError(500, 'ORIGIN_CONFIGURATION_MISSING');
  }
}

export function pagesOrigin(env: Env): string {
  return configuredOrigin(env.GITHUB_PAGES_ORIGIN);
}

export function rawContentOrigin(env: Env): string {
  return configuredOrigin(env.RAW_CONTENT_ORIGIN || env.GITHUB_PAGES_ORIGIN);
}

export function siteOrigin(env: Env): string {
  return configuredOrigin(env.SITE_BASE_URL);
}

export const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wasm': 'application/wasm', '.pdf': 'application/pdf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

export function extension(pathname: string): string {
  const basename = pathname.slice(pathname.lastIndexOf('/') + 1);
  const dot = basename.lastIndexOf('.');
  return dot < 0 ? '' : basename.slice(dot).toLowerCase();
}

const CONTROL_FILES = new Set([
  '/robots.txt', '/sitemap.xml', '/sitemap-index.xml', '/sitemap_index.xml',
  '/rss.xml', '/atom.xml', '/feed.xml', '/manifest.json', '/site.webmanifest',
]);
export function isPrivatePagePath(pathname: string): boolean {
  return /^\/admin(?:\/(?:login|new-post|auth\/callback|config(?:\/[^/]+){0,2}))?\/?$/.test(pathname);
}

const STATIC_PREFIXES = ['/assets/', '/images/', '/ai-memo/', '/fonts/', '/demos/', '/.well-known/'];

export type ResourcePolicy = {
  origin: 'pages' | 'raw';
  mime: string;
  cache: 'revalidate' | 'mutable' | 'immutable';
};

// Keep page aliases ahead of extension heuristics: a post may be named "node.js".
// /posts/.../*.html, on the other hand, is a simulator/document, not a post page.
export function articlePath(pathname: string): { year: string; slug: string } | null {
  const match = pathname.match(/^\/(blog|post|posts)\/(\d{4})\/([^/]+?)(?:\/index\.html)?\/?$/);
  if (!match) return null;
  const [, prefix, year, segment] = match;
  const ext = extension(segment);
  if (prefix === 'posts' && Object.hasOwn(MIME_TYPES, ext)) return null;
  return { year, slug: decodePathSegment(segment) };
}

export function resourcePolicy(pathname: string): ResourcePolicy | null {
  if (pathname === '/index.html' || isPrivatePagePath(pathname) || articlePath(pathname)) return null;
  const ext = extension(pathname);
  const knownExtension = Object.hasOwn(MIME_TYPES, ext);
  const staticPrefix = STATIC_PREFIXES.some(prefix => pathname.startsWith(prefix));
  const contentPrefix = /^\/(posts|project-data)\//.test(pathname);
  if (!knownExtension && !staticPrefix && !contentPrefix) return null;

  const control = CONTROL_FILES.has(pathname) || /^\/sitemaps\/.+\.xml$/.test(pathname);
  const raw = !control && !staticPrefix && ['.json', '.md', '.markdown', '.xml', '.txt'].includes(ext);
  const fingerprinted = /^\/assets\/(?:[^/]+\/)*[^/]+-[A-Za-z0-9_-]{8}\.(?:js|mjs|css|woff2?|ttf|png|jpe?g|webp|avif|svg)(?:\.map)?$/.test(pathname);
  return {
    origin: raw ? 'raw' : 'pages',
    mime: MIME_TYPES[ext] || 'application/octet-stream',
    cache: control || raw || ext === '.webmanifest' ? 'revalidate' : fingerprinted ? 'immutable' : 'mutable',
  };
}

export function applyResourceCachePolicy(headers: Headers, policy: ResourcePolicy, status: number): void {
  // These independent edge directives must not override the bounded policy below.
  for (const key of ['CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control', 'Surrogate-Control', 'Expires']) {
    headers.delete(key);
  }
  const current = headers.get('Cache-Control') || '';
  if (headers.has('Set-Cookie') || status >= 400) {
    headers.set('Cache-Control', 'no-store');
  } else if (/\b(?:private|no-store|no-cache)\b/i.test(current)) {
    headers.set('Cache-Control', current.replace(/(?:^|,)\s*immutable\s*(?=,|$)/gi, '').replace(/^,\s*/, ''));
  } else if (policy.cache === 'revalidate') {
    headers.set('Cache-Control', 'public, no-cache, must-revalidate');
  } else if (policy.cache === 'immutable' && (status === 200 || status === 304 || status === 206)) {
    const originAge = current.match(/(?:^|,)\s*max-age\s*=\s*(\d+)/i);
    const age = Math.min(Number(originAge?.[1] ?? 31536000), 31536000);
    headers.set('Cache-Control', `public, max-age=${age}, ${age === 0 ? 'must-revalidate' : 'immutable'}`);
  } else {
    const maxAge = current.match(/(?:^|,)\s*max-age\s*=\s*(\d+)/i);
    headers.set('Cache-Control', `public, max-age=${Math.min(Number(maxAge?.[1] ?? 300), 300)}, must-revalidate`);
  }
}


// Link is a list whose URI references and quoted parameters may themselves
// contain commas/semicolons. Only canonical relations are removed.
function splitHeaderParts(input: string, separator: string): string[] {
  let quoted = false;
  let inUri = false;
  let escaped = false;
  let start = 0;
  const entries: string[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (escaped) { escaped = false; continue; }
    if (quoted && char === '\\') { escaped = true; continue; }
    if (char === '"' && !inUri) quoted = !quoted;
    if (!quoted && char === '<') inUri = true;
    if (!quoted && char === '>') inUri = false;
    if (char === separator && !quoted && !inUri) {
      entries.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  entries.push(input.slice(start).trim());
  return entries;
}

export function stripCanonicalLinkHeader(headers: Headers): void {
  const input = headers.get('Link');
  if (!input) return;
  const kept = splitHeaderParts(input, ',').filter(entry => {
    const parameters = splitHeaderParts(entry, ';').slice(1);
    return !parameters.some(parameter => {
      const rel = parameter.match(/^rel\s*=\s*(?:"([^"]*)"|([^;\s,]+))\s*$/i);
      return (rel?.[1] ?? rel?.[2] ?? '').toLowerCase().split(/\s+/).includes('canonical');
    });
  });
  if (kept.length) headers.set('Link', kept.join(', '));
  else headers.delete('Link');
}
