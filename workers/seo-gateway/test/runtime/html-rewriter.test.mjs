import assert from 'node:assert/strict';
import test, { before, after, beforeEach } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, Response as OriginResponse } from 'miniflare';

// Real workerd/HTMLRewriter, not a regex/pass-through substitute. The public
// origin alone is a local fixture: tests cannot make live/provider requests.
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const agents = ['Googlebot', 'Bingbot', 'Mozilla/5.0'];
const bindings = {
  GITHUB_PAGES_ORIGIN: 'https://pages.test/blog',
  RAW_CONTENT_ORIGIN: 'https://raw.test/repo/public',
  SITE_BASE_URL: 'https://site.test', API_BASE_URL: 'https://api.test', SITE_NAME: 'Site',
};
const sourceTitle = '한글 < B & "quote" </title><script>bad()</script>';
const post = { year: '2026', slug: '한글 제목', title: sourceTitle, description: 'A & B <test>', published: true };
let mf;
let template;
let shellStatus;
let manifestStatus;
let calls;
const shell = (canonical = true) => `<!doctype html><html><head>
<title>OLD TITLE</title><title>SECOND TITLE</title>
<meta name="DESCRIPTION" content="Old"><meta name="description" content="Other">
${canonical ? '<link rel="canonical" href="https://old.test/"><link REL="CANONICAL" href="https://other.test/">' : ''}
<meta property="og:title" content="OLD"><meta name="twitter:card" content="summary">
<meta property="article:tag" content="old-tag"><meta name="robots" content="index, follow">
<link rel="stylesheet" href="/assets/app.css"><meta name="google-site-verification" content="keep">
<script type="application/ld+json">{"@type":"WebSite","name":"origin-owned"}</script>
</head><body><div id="root"></div><p>Keep original body</p><script src="/assets/app.js"></script></body></html>`;
function streamHtml(html) {
  const bytes = new TextEncoder().encode(html);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      // Deliberately split tags, attributes and multibyte Unicode across chunks.
      controller.enqueue(bytes.slice(offset, offset + 7));
      offset += 7;
    },
  });
}
function tags(html, name) { return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || []; }
function canonicalLinks(html) { return tags(html, 'link').filter(tag => /rel="canonical"/i.test(tag)); }

before(async () => {
  const bundle = await build({
    entryPoints: [path.join(workspace, 'src/index.ts')], bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent',
  });
  mf = new Miniflare({
    modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2025-01-01', compatibilityFlags: ['nodejs_compat'],
    cf: false, bindings,
    outboundService: async request => {
      const url = new URL(request.url);
      calls.push({ url: request.url, method: request.method, headers: Object.fromEntries(request.headers) });
      if (url.hostname === 'raw.test' && url.pathname === '/repo/public/posts-manifest.json') {
        return new OriginResponse(JSON.stringify({ items: [post, { ...post, slug: 'node.js', title: 'Node.js' }] }), {
          status: manifestStatus, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.hostname === 'pages.test' && url.pathname === '/blog/index.html') {
        return new OriginResponse(request.method === 'HEAD' ? null : streamHtml(template), {
          status: shellStatus, headers: { 'Content-Type': 'text/html; charset=utf-8',
            ETag: '"old-shell"', 'Last-Modified': 'Thu, 10 Sep 2026 00:00:00 GMT',
            'Content-Security-Policy': "default-src 'self'; script-src 'self'",
            Link: '</assets/app.js>; rel=preload, <https://old.test>; rel=canonical',
          },
        });
      }
      if (url.hostname === 'pages.test' && ['/blog/robots.txt', '/blog/sitemap.xml', '/blog/rss.xml'].includes(url.pathname)) {
        const type = url.pathname.endsWith('.txt') ? 'text/plain' : 'application/xml';
        return new OriginResponse(request.method === 'HEAD' ? null : 'origin-file', {
          headers: { 'Content-Type': type, ETag: '"resource"', 'Cache-Control': 'max-age=31536000, immutable' },
        });
      }
      // No fallback to global fetch: unexpected URLs fail the fixture/test.
      throw new Error(`Unexpected outbound origin request: ${request.method} ${request.url}`);
    },
  });
  await mf.ready;
});
beforeEach(() => {
  template = shell(); shellStatus = 200; manifestStatus = 200; calls = [];
});
after(async () => { await mf?.dispose(); });

for (const ua of agents) {
  test(`real HTMLRewriter: projects has one canonical/title/description for ${ua}`, async () => {
    const response = await mf.dispatchFetch('https://site.test/projects', { headers: { 'User-Agent': ua } });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.deepEqual(canonicalLinks(html), ['<link rel="canonical" href="https://site.test/projects" />']);
    assert.equal(tags(html, 'title').length, 1);
    assert.equal(tags(html, 'meta').filter(tag => /name="description"/i.test(tag)).length, 1);
    assert.match(html, /<title>Projects \| Site<\/title>/);
    assert.doesNotMatch(html, /OLD TITLE|SECOND TITLE|old-tag|https:\/\/old.test/);
    assert.match(html, /Keep original body/);
    assert.match(html, /google-site-verification/);
    assert.match(html, /origin-owned/); // JSON-LD is deliberately NOT rewritten in A01.
    assert.match(html, /src="\/assets\/app.js"/);
    assert.equal(response.headers.get('ETag'), null);
    assert.equal(response.headers.get('Link'), '</assets/app.js>; rel=preload');
    assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'self'; script-src 'self'");
  });
}

test('real HTMLRewriter inserts missing owned tags exactly once', async () => {
  template = shell(false).replace(/<title>[\s\S]*?<\/title>/g, '').replace(/<meta name="description"[^>]*>/gi, '');
  const response = await mf.dispatchFetch('https://site.test/about');
  const html = await response.text();
  assert.equal(canonicalLinks(html).length, 1);
  assert.equal(tags(html, 'title').length, 1);
  assert.equal(tags(html, 'meta').filter(tag => /name="description"/i.test(tag)).length, 1);
});

test('real streaming HTMLRewriter escapes Unicode article metadata and preserves body', async () => {
  const response = await mf.dispatchFetch(`https://site.test/blog/2026/${encodeURIComponent(post.slug)}`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(canonicalLinks(html).length, 1);
  assert.match(html, /한글 &lt; B &amp; &quot;quote&quot;/);
  assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
  assert.match(html, /&lt;\/title&gt;&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(html, /Keep original body/);
});

test('real runtime keeps dotted published slug as an article', async () => {
  const response = await mf.dispatchFetch('https://site.test/blog/2026/node.js');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<title>Node.js \| Site<\/title>/);
});

test('real runtime rejects double encoding before origin access', async () => {
  const response = await mf.dispatchFetch('https://site.test/blog/2026/%252F');
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test('real runtime missing post gives 404 and a known page origin failure gives 503', async () => {
  const missing = await mf.dispatchFetch('https://site.test/blog/2026/does-not-exist');
  assert.equal(missing.status, 404);
  await missing.text();
  shellStatus = 503;
  const failed = await mf.dispatchFetch('https://site.test/projects');
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get('Cache-Control'), 'no-store');
  await failed.text();
});

test('real runtime GET and HEAD agree on page headers; HEAD has no body', async () => {
  const get = await mf.dispatchFetch('https://site.test/projects');
  const head = await mf.dispatchFetch('https://site.test/projects', { method: 'HEAD', headers: { 'If-None-Match': '"old-shell"' } });
  assert.equal(head.status, get.status);
  for (const name of ['Content-Type', 'Cache-Control', 'ETag', 'Content-Length', 'Link', 'X-SEO-Gateway']) {
    assert.equal(head.headers.get(name), get.headers.get(name));
  }
  assert.equal(await head.text(), '');
  await get.text();
});

test('real runtime control-file responses are independent of crawler identity', async () => {
  for (const pathname of ['/robots.txt', '/sitemap.xml', '/rss.xml']) {
    const bodies = [];
    for (const ua of agents) {
      const response = await mf.dispatchFetch(`https://site.test${pathname}`, { headers: { 'User-Agent': ua } });
      assert.equal(response.status, 200);
      assert.doesNotMatch(response.headers.get('Content-Type'), /html/);
      assert.doesNotMatch(response.headers.get('Cache-Control'), /immutable|31536000/);
      bodies.push(await response.text());
    }
    assert.deepEqual(bodies, ['origin-file', 'origin-file', 'origin-file']);
  }
});

test('real runtime private admin shell is not shared-cacheable or indexable', async () => {
  const response = await mf.dispatchFetch('https://site.test/admin/auth/callback');
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
  assert.equal(tags(html, 'meta').filter(tag => /name="robots"/i.test(tag)).length, 1);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});
