import type { Env } from './types';
import { isCrawler } from './crawler-detect';
import { resolvePostMeta } from './post-resolver';
import { createRewriter } from './meta-rewriter';
const HTML_SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy':
    "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https: wss:; frame-src 'self' https:; base-uri 'self'; frame-ancestors 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
});

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function applyHtmlSecurityHeaders(headers: Headers): Headers {
  for (const [key, value] of Object.entries(HTML_SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return headers;
}

function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, '');
}

function getPagesOrigin(env: Env): string | null {
  return env.GITHUB_PAGES_ORIGIN ? normalizeOrigin(env.GITHUB_PAGES_ORIGIN) : null;
}

function getRawContentOrigin(env: Env): string | null {
  return env.RAW_CONTENT_ORIGIN
    ? normalizeOrigin(env.RAW_CONTENT_ORIGIN)
    : getPagesOrigin(env);
}

async function fetchBuiltIndexHtml(env: Env): Promise<Response> {
  const pagesOrigin = getPagesOrigin(env);
  if (!pagesOrigin) {
    return new Response('SEO origin configuration missing', { status: 500 });
  }

  const response = await fetch(`${pagesOrigin}/index.html`, {
    headers: { 'User-Agent': 'SEO-Gateway/1.0' },
    redirect: 'follow',
  });

  if (!response.ok) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=300');
  applyHtmlSecurityHeaders(headers);

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

async function fetchFromConfiguredOrigins(env: Env, path: string): Promise<Response> {
  const strippedPath = path.split('?')[0];
  const isJson = strippedPath.endsWith('.json');
  const isIndexHtml = strippedPath === '/' || strippedPath === '/index.html' || strippedPath === '';
  const pagesOrigin = getPagesOrigin(env);
  const rawOrigin = getRawContentOrigin(env);

  if (!pagesOrigin || !rawOrigin) {
    return new Response('SEO origin configuration missing', { status: 500 });
  }

  let fetchUrl: string;
  if (isJson) {
    fetchUrl = `${rawOrigin}${strippedPath}`;
  } else if (isIndexHtml) {
    fetchUrl = `${pagesOrigin}/index.html`;
  } else {
    fetchUrl = `${pagesOrigin}${strippedPath}`;
  }

  const response = await fetch(fetchUrl, {
    headers: { 'User-Agent': 'SEO-Gateway/1.0' },
    redirect: 'follow',
  });
  
  if (!response.ok) {
    return response;
  }
  
  const contentType = getMimeType(strippedPath || '.html');
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Content-Type', contentType);
  if (strippedPath.startsWith('/assets/') || strippedPath.includes('/images/')) {
    newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (isJson) {
    newHeaders.set('Cache-Control', 'public, no-cache, must-revalidate');
  } else {
    newHeaders.set('Cache-Control', 'public, max-age=300');
  }
  if (contentType.startsWith('text/html')) {
    applyHtmlSecurityHeaders(newHeaders);
  }
  
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent');

    if (url.pathname === '/api/seo-debug') {
      const testPath = url.searchParams.get('path') || '/';
      const testUrl = new URL(testPath, env.SITE_BASE_URL);
      const meta = await resolvePostMeta(testUrl, env);
      return new Response(JSON.stringify({ 
        meta, 
        isCrawler: isCrawler(userAgent),
        origins: {
          pages: env.GITHUB_PAGES_ORIGIN,
          raw: env.RAW_CONTENT_ORIGIN ?? env.GITHUB_PAGES_ORIGIN
        }
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isCrawler(userAgent)) {
      let requestPath = url.pathname;
      
      if (requestPath.includes('.')) {
        return fetchFromConfiguredOrigins(env, requestPath + url.search);
      }
      
      const htmlResponse = await fetchBuiltIndexHtml(env);
      return htmlResponse;
    }

    const meta = await resolvePostMeta(url, env);

    const originResponse = await fetchBuiltIndexHtml(env);

    if (!originResponse.ok) {
      return new Response('Not Found', { status: 404 });
    }

    const rewriter = createRewriter(meta, env);
    const transformedResponse = rewriter.transform(originResponse);

    const newHeaders = new Headers(transformedResponse.headers);
    newHeaders.set('Content-Type', 'text/html; charset=utf-8');
    newHeaders.set('X-SEO-Gateway', 'active');
    newHeaders.set('Cache-Control', 'public, max-age=300');
    applyHtmlSecurityHeaders(newHeaders);

    return new Response(transformedResponse.body, {
      status: 200,
      headers: newHeaders,
    });
  },
};
