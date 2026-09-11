import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SeoGatewayError, normalizeRequestPath, normalizeManifestSlug, articlePath,
  resourcePolicy, applyResourceCachePolicy, configuredOrigin, stripCanonicalLinkHeader,
} from '../src/request-policy';

for (const slug of ['감동을_잃어버린_그대들에게', 'Container Network Interface', '_index', 'node.js', 'v1.2']) {
  test(`path: preserves valid published slug ${slug}`, () => {
    const path = normalizeRequestPath(`/blog/2026/${encodeURIComponent(slug)}`);
    assert.deepEqual(articlePath(path), { year: '2026', slug });
    assert.equal(resourcePolicy(path), null);
  });
}

test('path: NFC comparison does not double-decode manifest text', () => {
  const path = normalizeRequestPath(`/blog/2026/${encodeURIComponent('한글'.normalize('NFD'))}`);
  assert.equal(path, `/blog/2026/${encodeURIComponent('한글')}`);
  assert.equal(normalizeManifestSlug('한글'.normalize('NFD')), '한글');
  assert.throws(() => normalizeManifestSlug('%ED%95%9C'), SeoGatewayError);
});

for (const segment of ['%2Fetc', '%5cpath', '%00bad', '%7Fbad', '%C2%85bad', '%3Fquery', '%23hash', '%252e%252e', '%252F', '%', '%ED%A0%80', '.', '..']) {
  test(`path: rejects unsafe or repeatedly encoded segment ${segment}`, () => {
    assert.throws(() => normalizeRequestPath(`/blog/2026/${segment}`),
      (error: unknown) => error instanceof SeoGatewayError && error.status === 400);
  });
}

test('path: rejects repeated separators', () => {
  for (const path of ['//evil.test/x', '/blog//2026/a', 'missing-slash']) {
    assert.throws(() => normalizeRequestPath(path), SeoGatewayError);
  }
});

const classification: Array<[string, string | null, string | null]> = [
  ['/robots.txt', 'pages', 'revalidate'], ['/sitemap.xml', 'pages', 'revalidate'],
  ['/rss.xml', 'pages', 'revalidate'], ['/atom.xml', 'pages', 'revalidate'],
  ['/posts-manifest.json', 'raw', 'revalidate'], ['/projects-manifest.json', 'raw', 'revalidate'],
  ['/posts/2026/a.md', 'raw', 'revalidate'], ['/posts/2026/manifest.json', 'raw', 'revalidate'],
  ['/project-data/a.md', 'raw', 'revalidate'], ['/assets/config.json', 'pages', 'mutable'],
  ['/assets/index-D1e2F3g4.js', 'pages', 'immutable'], ['/assets/app.css', 'pages', 'mutable'],
  ['/images/cover.png', 'pages', 'mutable'], ['/ai-memo/ai-memo.js', 'pages', 'mutable'],
  ['/posts/2026/a-simulator.html', 'pages', 'mutable'], ['/site.webmanifest', 'pages', 'revalidate'],
  ['/post/2026/node.js', null, null], ['/post/2026/a/index.html', null, null],
  ['/blog/2026/title.html', null, null], ['/admin/config/chat.js', null, null],
  ['/unknown.route', null, null], ['/index.html', null, null],
];
for (const [path, origin, cache] of classification) {
  test(`route classification: ${path}`, () => {
    const policy = resourcePolicy(path);
    assert.equal(policy?.origin ?? null, origin);
    assert.equal(policy?.cache ?? null, cache);
  });
}

test('origin: preserves configured base path and rejects unsafe config', () => {
  assert.equal(configuredOrigin('https://pages.example/blog/'), 'https://pages.example/blog');
  for (const value of [undefined, '', 'http://pages.example', 'https://user:pass@pages.example', 'https://pages.example?query=1']) {
    assert.throws(() => configuredOrigin(value), SeoGatewayError);
  }
});

test('cache: mutable content never inherits a year-long or independent CDN policy', () => {
  for (const path of ['/robots.txt', '/sitemap.xml', '/rss.xml', '/images/a.png', '/posts-manifest.json']) {
    const headers = new Headers({ 'Cache-Control': 'public, max-age=31536000, immutable',
      'CDN-Cache-Control': 'max-age=31536000', 'Cloudflare-CDN-Cache-Control': 'max-age=31536000',
      'Surrogate-Control': 'max-age=31536000', Expires: 'Thu, 01 Jan 2099 00:00:00 GMT', ETag: '"asset-v1"' });
    applyResourceCachePolicy(headers, resourcePolicy(path)!, 200);
    assert.doesNotMatch(headers.get('Cache-Control')!, /31536000|immutable/);
    assert.equal(headers.get('CDN-Cache-Control'), null);
    assert.equal(headers.get('Cloudflare-CDN-Cache-Control'), null);
    assert.equal(headers.get('Surrogate-Control'), null);
    assert.equal(headers.get('Expires'), null);
    assert.equal(headers.get('ETag'), '"asset-v1"');
  }
});

test('cache: private/no-store/no-cache restrictions outrank hashed names', () => {
  for (const existing of ['private, max-age=0', 'no-store', 'no-cache, immutable']) {
    const headers = new Headers({ 'Cache-Control': existing });
    applyResourceCachePolicy(headers, resourcePolicy('/assets/index-D1e2F3g4.js')!, 200);
    assert.match(headers.get('Cache-Control')!, /private|no-store|no-cache/);
    assert.doesNotMatch(headers.get('Cache-Control')!, /immutable/);
  }
  for (const status of [404, 503]) {
    const headers = new Headers();
    applyResourceCachePolicy(headers, resourcePolicy('/assets/index-D1e2F3g4.js')!, status);
    assert.equal(headers.get('Cache-Control'), 'no-store');
  }
  const headers = new Headers({ 'Set-Cookie': 'public-origin-cookie=x' });
  applyResourceCachePolicy(headers, resourcePolicy('/assets/index-D1e2F3g4.js')!, 200);
  assert.equal(headers.get('Cache-Control'), 'no-store');
});

test('canonical HTTP Link removal preserves preload URLs/quoted commas', () => {
  const preload = '</assets/app.js?x=a,b>; rel="preload"; title="a,b"; as=script';
  const headers = new Headers({ Link: `${preload}, <https://old.test/>; REL="alternate canonical", </feed>; rel=alternate` });
  stripCanonicalLinkHeader(headers);
  assert.equal(headers.get('Link'), `${preload}, </feed>; rel=alternate`);
  headers.set('Link', '<https://old.test/>; rel=canonical');
  stripCanonicalLinkHeader(headers);
  assert.equal(headers.get('Link'), null);
});

test('Link metadata text cannot be mistaken for the canonical relation parameter', () => {
  const preload = '</assets/app.js>; title="a; rel=canonical, b"; rel=preload';
  const headers = new Headers({ Link: `${preload}, <https://old.test>; rel="canonical"` });
  stripCanonicalLinkHeader(headers);
  assert.equal(headers.get('Link'), preload);
});

test('hash-shaped asset rules do not match a production suffix or extend an explicit origin TTL', () => {
  assert.equal(resourcePolicy('/assets/app-production.js')?.cache, 'mutable');
  const headers = new Headers({ 'Cache-Control': 'public, max-age=60' });
  applyResourceCachePolicy(headers, resourcePolicy('/assets/index-ABC123xy.js')!, 200);
  assert.match(headers.get('Cache-Control')!, /max-age=60,/);
  headers.set('Cache-Control', 'public, max-age=0');
  applyResourceCachePolicy(headers, resourcePolicy('/assets/index-ABC123xy.js')!, 200);
  assert.equal(headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
});
