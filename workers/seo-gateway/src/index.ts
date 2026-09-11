import type { Env, PostMeta } from './types';
import { isCrawler } from './crawler-detect';
import { resolvePostMeta } from './post-resolver';
import { createRewriter } from './meta-rewriter';
import {
  SeoGatewayError, applyResourceCachePolicy, normalizeRequestPath, stripCanonicalLinkHeader,
  pagesOrigin, rawContentOrigin, resourcePolicy, siteOrigin,
  type ResourcePolicy,
} from './request-policy';

const HTML_SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy':
    "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https: wss:; frame-src 'self' https:; base-uri 'self'; frame-ancestors 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
});
const VALIDATOR_HEADERS = ['If-None-Match', 'If-Modified-Since', 'Range', 'If-Range', 'If-Match', 'If-Unmodified-Since'];

function applyHtmlSecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(HTML_SECURITY_HEADERS)) {
    // Never weaken a stricter CSP returned by the built origin.
    if (!headers.has(key)) headers.set(key, value);
  }
}

function withoutBody(response: Response): Response {
  return new Response(null, {
    status: response.status, statusText: response.statusText, headers: response.headers,
  });
}

function errorResponse(request: Request, status: number, code: string): Response {
  const label = status === 404 ? 'Not Found' : status === 400 ? 'Bad Request' :
    status === 405 ? 'Method Not Allowed' : 'Service unavailable';
  const headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow',
    'X-SEO-Error': code,
  });
  if (status === 405) headers.set('Allow', 'GET, HEAD');
  if (status === 503 || status === 504) headers.set('Retry-After', '30');
  return new Response(request.method === 'HEAD' ? null : label, { status, headers });
}

async function fetchOrigin(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new SeoGatewayError(error instanceof Error && error.name === 'TimeoutError' ? 504 : 503, 'ORIGIN_UNAVAILABLE');
  }
}

async function proxyResource(request: Request, env: Env, path: string, policy: ResourcePolicy): Promise<Response> {
  const origin = policy.origin === 'raw' ? rawContentOrigin(env) : pagesOrigin(env);
  const headers = new Headers({ 'User-Agent': 'SEO-Gateway/2.0' });
  for (const name of ['Accept', ...VALIDATOR_HEADERS]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Deliberately do not send site cookies, bearer credentials or referrers to
  // public GitHub origins. Query strings are preserved only for actual files.
  const response = await fetchOrigin(`${origin}${path}`, { method: request.method, headers });
  const output = new Headers(response.headers);
  const mime = output.get('Content-Type');
  if (response.ok && policy.mime !== 'text/html; charset=utf-8' &&
      /^text\/html(?:;|$)/i.test(mime || '')) {
    await response.body?.cancel().catch(() => undefined);
    return errorResponse(request, 502, 'RESOURCE_RETURNED_HTML');
  }
  // Fill a missing header only; a declared HTML fallback was rejected above.
  if (response.ok && !mime) output.set('Content-Type', policy.mime);
  output.set('X-Content-Type-Options', 'nosniff');
  applyResourceCachePolicy(output, policy, response.status);
  if (/^text\/html(?:;|$)/i.test(output.get('Content-Type') || '')) {
    applyHtmlSecurityHeaders(output);
  }
  return new Response(request.method === 'HEAD' || [204, 205, 304].includes(response.status) ? null : response.body, {
    status: response.status, statusText: response.statusText, headers: output,
  });
}

async function servePage(request: Request, env: Env, meta: PostMeta): Promise<Response> {
  const response = await fetchOrigin(`${pagesOrigin(env)}/index.html`, {
    method: request.method,
    headers: { 'User-Agent': 'SEO-Gateway/2.0', Accept: 'text/html' },
  });
  if (response.status !== 200) {
    // The page was resolved already. A missing shell is an origin failure, not
    // evidence that a published article has permanently disappeared.
    await response.body?.cancel().catch(() => undefined);
    return errorResponse(request, response.status >= 500 ? response.status : 502, 'PAGE_ORIGIN_UNAVAILABLE');
  }
  const type = response.headers.get('Content-Type');
  if (type && !/^text\/html(?:;|$)/i.test(type)) {
    await response.body?.cancel().catch(() => undefined);
    return errorResponse(request, 502, 'INVALID_PAGE_CONTENT_TYPE');
  }
  const headers = new Headers(response.headers);
  // The shell's validators describe the unmodified, shared index. Reusing them
  // can return 304 for the wrong title/canonical or carry the wrong byte length.
  // File requests preserve validators; transformed pages fetch unconditionally.
  for (const name of ['ETag', 'Last-Modified', 'Content-Length', 'Content-Encoding',
    'Content-MD5', 'Digest', 'Content-Digest', 'Repr-Digest', 'Accept-Ranges', 'Content-Range',
    'CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control', 'Surrogate-Control', 'Expires', 'Age']) {
    headers.delete(name);
  }
  stripCanonicalLinkHeader(headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('X-SEO-Gateway', 'active');
  const restricted = /\b(?:private|no-store|no-cache)\b/i.test(response.headers.get('Cache-Control') || '');
  headers.set('Cache-Control', meta.noIndex || restricted || headers.has('Set-Cookie') ? 'no-store' : 'public, max-age=300, must-revalidate');
  if (meta.noIndex) headers.set('X-Robots-Tag', 'noindex, nofollow');
  applyHtmlSecurityHeaders(headers);
  if (request.method === 'HEAD') {
    return new Response(null, { status: meta.httpStatus || 200, headers });
  }
  const rewritten = createRewriter(meta, env).transform(response);
  return new Response(rewritten.body, { status: meta.httpStatus || 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return errorResponse(request, 405, 'METHOD_NOT_ALLOWED');
    }
    try {
      const url = new URL(request.url);
      const pathname = normalizeRequestPath(url.pathname);
      if (pathname === '/api/seo-debug') {
        const target = new URL(url.searchParams.get('path') || '/', `${siteOrigin(env)}/`);
        if (target.origin !== new URL(siteOrigin(env)).origin) {
          throw new SeoGatewayError(400, 'INVALID_DEBUG_PATH');
        }
        const meta = await resolvePostMeta(target, env);
        const response = Response.json({ meta, isCrawler: isCrawler(request.headers.get('User-Agent')) }, {
          headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
        });
        return request.method === 'HEAD' ? withoutBody(response) : response;
      }

      // Files must bypass metadata resolution for ALL user agents. Page content
      // also follows one route, avoiding crawler-only HTML/cache differences.
      const policy = resourcePolicy(pathname);
      if (policy) return await proxyResource(request, env, `${pathname}${url.search}`, policy);

      const meta = await resolvePostMeta(url, env);
      const canonicalPath = new URL(meta.url).pathname;
      if (url.pathname !== canonicalPath && !meta.noIndex) {
        return new Response(null, {
          status: 308,
          headers: { Location: `${meta.url}${url.search}`, 'Cache-Control': 'public, max-age=300' },
        });
      }
      return await servePage(request, env, meta);
    } catch (error) {
      if (error instanceof SeoGatewayError) return errorResponse(request, error.status, error.code);
      return errorResponse(request, 500, 'SEO_GATEWAY_ERROR');
    }
  },
};
