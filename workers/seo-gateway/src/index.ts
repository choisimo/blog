import type { Env } from './types';
import { isCrawler } from './crawler-detect';
import { resolvePostMeta } from './post-resolver';
import { createRewriter } from './meta-rewriter';

const GITHUB_PAGES_CDN = 'https://choisimo.github.io/blog';
// JSON manifests must bypass GitHub Pages/Fastly cache (which has max-age=31536000,immutable).
// raw.githubusercontent.com serves repo files fresh on every request with no immutable caching.
const RAW_GITHUB_SOURCE = 'https://raw.githubusercontent.com/choisimo/blog/main/frontend/public';
// index.html lives at repo root (Vite template), not under public/
const RAW_INDEX_HTML_URL = 'https://raw.githubusercontent.com/choisimo/blog/main/frontend/index.html';

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

async function fetchFromRawGitHub(path: string): Promise<Response> {
  const strippedPath = path.split('?')[0];
  const isJson = strippedPath.endsWith('.json');
  const isIndexHtml = strippedPath === '/' || strippedPath === '/index.html' || strippedPath === '';

  let fetchUrl: string;
  if (isJson) {
    fetchUrl = `${RAW_GITHUB_SOURCE}${strippedPath}`;
  } else if (isIndexHtml) {
    fetchUrl = `${GITHUB_PAGES_CDN}/index.html`;
  } else {
    fetchUrl = `${GITHUB_PAGES_CDN}${strippedPath}`;
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
  newHeaders.delete('Content-Security-Policy');
  
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
          raw: env.GITHUB_PAGES_ORIGIN,
          cdn: GITHUB_PAGES_CDN
        }
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isCrawler(userAgent)) {
      let requestPath = url.pathname;
      
      if (requestPath.includes('.')) {
        return fetchFromRawGitHub(requestPath + url.search);
      }
      
      const htmlResponse = await fetchFromRawGitHub('/index.html');
      return htmlResponse;
    }

    const meta = await resolvePostMeta(url, env);

    const originResponse = await fetch(RAW_INDEX_HTML_URL, {
      headers: { 'User-Agent': 'SEO-Gateway/1.0' },
      redirect: 'follow',
    });

    if (!originResponse.ok) {
      return new Response('Not Found', { status: 404 });
    }

    const rewriter = createRewriter(meta, env);
    const transformedResponse = rewriter.transform(originResponse);

    const newHeaders = new Headers(transformedResponse.headers);
    newHeaders.set('Content-Type', 'text/html; charset=utf-8');
    newHeaders.set('X-SEO-Gateway', 'active');
    newHeaders.set('Cache-Control', 'public, max-age=300');

    return new Response(transformedResponse.body, {
      status: 200,
      headers: newHeaders,
    });
  },
};
