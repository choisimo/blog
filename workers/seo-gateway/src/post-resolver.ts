import type { Env, PostMeta, Manifest, ManifestItem } from './types';
import {
  SeoGatewayError, articlePath, configuredOrigin, normalizeManifestSlug,
  normalizeRequestPath, rawContentOrigin, siteOrigin, isPrivatePagePath,
} from './request-policy';

const manifestCache = new Map<string, { data: Manifest; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHED_ORIGINS = 8;

export function invalidateManifestCache(): void {
  manifestCache.clear();
}

function validateManifest(value: unknown): Manifest {
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)) {
    throw new SeoGatewayError(502, 'INVALID_MANIFEST');
  }
  const seen = new Set<string>();
  for (const item of value.items) {
    if (!item || typeof item !== 'object' || typeof item.year !== 'string' ||
        !/^\d{4}$/.test(item.year) || typeof item.slug !== 'string' ||
        typeof item.title !== 'string' || !item.title.trim() ||
        (item.published !== undefined && typeof item.published !== 'boolean')) {
      throw new SeoGatewayError(502, 'INVALID_MANIFEST');
    }
    const key = `${item.year}/${normalizeManifestSlug(item.slug)}`;
    if (seen.has(key)) throw new SeoGatewayError(502, 'AMBIGUOUS_MANIFEST');
    seen.add(key);
  }
  if ('total' in value && value.total !== value.items.length) {
    throw new SeoGatewayError(502, 'INCOMPLETE_MANIFEST');
  }
  return value as Manifest;
}

async function fetchManifest(env: Env): Promise<Manifest> {
  // Use the same manifest origin as public /posts-manifest.json. Cache data,
  // never Responses or cross-request in-flight I/O handles, and isolate origins.
  const origin = rawContentOrigin(env);
  const cached = manifestCache.get(origin);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL) return cached.data;

  let response: Response;
  try {
    response = await fetch(`${origin}/posts-manifest.json`, {
      headers: { 'User-Agent': 'SEO-Gateway/2.0', Accept: 'application/json', 'Cache-Control': 'no-cache' },
      redirect: 'manual', signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new SeoGatewayError(error instanceof Error && error.name === 'TimeoutError' ? 504 : 503, 'MANIFEST_UNAVAILABLE');
  }
  if (response.status !== 200) {
    // A missing manifest does not prove that every article has been deleted.
    await response.body?.cancel().catch(() => undefined);
    throw new SeoGatewayError(response.status >= 500 ? response.status : 503, 'MANIFEST_UNAVAILABLE');
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SeoGatewayError(502, 'INVALID_MANIFEST');
  }
  const data = validateManifest(payload);
  if (manifestCache.size >= MAX_CACHED_ORIGINS && !manifestCache.has(origin)) {
    manifestCache.delete(manifestCache.keys().next().value!);
  }
  manifestCache.set(origin, { data, timestamp: now });
  return data;
}

function findPost(manifest: Manifest, year: string, slug: string): ManifestItem | undefined {
  return manifest.items.find(item => item.year === year &&
    normalizeManifestSlug(item.slug) === slug && item.published !== false);
}

function buildOgImageUrl(env: Env, title: string, subtitle?: string): string {
  const params = new URLSearchParams({ title, format: 'png' });
  if (subtitle) params.set('subtitle', subtitle);
  return `${configuredOrigin(env.API_BASE_URL)}/api/v1/og?${params}`;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function coverImage(value: unknown, env: Env): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value, `${siteOrigin(env)}/`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

const PUBLIC_PAGES: Readonly<Record<string, { title: string; description: string; canonical?: string }>> = {
  '/': { title: '', description: 'Tech & Programming Blog' },
  '/index.html': { title: '', description: 'Tech & Programming Blog', canonical: '/' },
  '/blog': { title: 'Blog', description: '기술, 개발, 생각에 대한 글들' },
  '/posts': { title: 'Blog', description: '기술, 개발, 생각에 대한 글들', canonical: '/blog' },
  '/projects': { title: 'Projects', description: '프로젝트와 공개 저장소' },
  '/about': { title: 'About', description: 'Nodove 소개' },
  '/contact': { title: 'About', description: 'Nodove 소개', canonical: '/about' },
  '/debate': { title: 'AI 토론', description: '주제에 대한 다양한 관점' },
  '/insight': { title: 'Insight', description: '읽으며 살펴보는 질문과 관점' },
};
const ERROR_PAGES: Readonly<Record<string, number>> = {
  '/400': 400, '/bad-request': 400, '/401': 401, '/unauthorized': 401,
  '/403': 403, '/forbidden': 403, '/404': 404,
  '/429': 429, '/too-many-requests': 429,
  '/500': 500, '/error': 500, '/server-error': 500,
  '/503': 503, '/maintenance': 503,
};

export async function resolvePostMeta(url: URL, env: Env): Promise<PostMeta> {
  const pathname = normalizeRequestPath(url.pathname);
  const article = articlePath(pathname);
  if (article) {
    const manifest = await fetchManifest(env);
    const post = findPost(manifest, article.year, article.slug);
    if (!post) throw new SeoGatewayError(404, 'POST_NOT_FOUND');
    const image = coverImage(post.coverImage, env);
    return {
      title: `${post.title} | ${env.SITE_NAME}`,
      description: text(post.description) || text(post.snippet) || '',
      ogImage: image || buildOgImageUrl(env, post.title, text(post.category)),
      ...(image ? {} : { ogImageWidth: 1200, ogImageHeight: 630 }),
      url: `${siteOrigin(env)}/blog/${article.year}/${encodeURIComponent(normalizeManifestSlug(post.slug))}`,
      type: 'article',
      publishedTime: text(post.date), author: text(post.author), category: text(post.category),
      tags: Array.isArray(post.tags) ? [...new Set(post.tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())))] : [],
    };
  }

  const pagePath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const page = PUBLIC_PAGES[pagePath];
  const privatePage = isPrivatePagePath(pagePath);
  const errorStatus = ERROR_PAGES[pagePath];
  if (!page && !privatePage && !errorStatus) throw new SeoGatewayError(404, 'PAGE_NOT_FOUND');
  const title = page?.title ?? (privatePage ? 'Admin' : String(errorStatus));
  return {
    title: title ? `${title} | ${env.SITE_NAME}` : env.SITE_NAME,
    description: page?.description || '',
    ogImage: buildOgImageUrl(env, title || env.SITE_NAME, env.SITE_NAME),
    ogImageWidth: 1200, ogImageHeight: 630,
    url: `${siteOrigin(env)}${page?.canonical ?? pagePath}`,
    type: 'website',
    ...(privatePage || errorStatus ? { noIndex: true } : {}),
    ...(errorStatus ? { httpStatus: errorStatus } : {}),
  };
}
