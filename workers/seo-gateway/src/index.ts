import type { Env } from './types';
import { isCrawler } from './crawler-detect';
import { resolvePostMeta } from './post-resolver';
import { createRewriter } from './meta-rewriter';

const GITHUB_PAGES_CDN = 'https://choisimo.github.io/blog';
const RAW_GITHUB_URL = 'https://choisimo.github.io/blog';

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
  const url = `${RAW_GITHUB_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'SEO-Gateway/1.0' },
  });
  
  if (!response.ok) {
    return response;
  }
  
  const contentType = getMimeType(path);
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Content-Type', contentType);
  newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
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
        return fetchFromRawGitHub(requestPath);
      }
      
      const htmlResponse = await fetchFromRawGitHub('/index.html');
      return htmlResponse;
    }

    const meta = await resolvePostMeta(url, env);

    const rawIndexUrl = `${env.GITHUB_PAGES_ORIGIN}/index.html`;
    const originResponse = await fetch(rawIndexUrl, {
      headers: { 'User-Agent': 'SEO-Gateway/1.0' },
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
