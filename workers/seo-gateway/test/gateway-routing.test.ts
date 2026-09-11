import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, mock } from 'node:test';
import worker from '../src/index';
import { invalidateManifestCache } from '../src/post-resolver';
import { env, post, jsonResponse, inputUrl } from './helpers/fixtures';

beforeEach(() => invalidateManifestCache());
afterEach(() => mock.restoreAll());
const agents = ['Googlebot', 'Bingbot', 'Mozilla/5.0'];
const files = [
  ['/robots.txt', 'pages', 'text/plain; charset=utf-8'],
  ['/sitemap.xml', 'pages', 'application/xml'],
  ['/rss.xml', 'pages', 'application/rss+xml'],
  ['/assets/app.js', 'pages', 'application/javascript'],
  ['/assets/app.css', 'pages', 'text/css'],
  ['/images/cover.png', 'pages', 'image/png'],
  ['/posts-manifest.json', 'raw', 'application/json'],
  ['/posts/2026/a.md', 'raw', 'text/plain; charset=utf-8'],
  ['/posts/2026/a-simulator.html', 'pages', 'text/html; charset=utf-8'],
];

for (const ua of agents) for (const [pathname, origin, mime] of files) {
  test(`resource parity: ${ua} ${pathname}`, async () => {
    const bytes = new Uint8Array([13, 10, 0, 45, 87, 128, 255]);
    const calls: string[] = [];
    mock.method(globalThis, 'fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(inputUrl(input));
      assert.equal(init?.method, 'GET');
      return new Response(bytes, { headers: { 'Content-Type': mime, ETag: '"v1"',
        'Last-Modified': 'Thu, 10 Sep 2026 00:00:00 GMT', 'Cache-Control': 'public, max-age=31536000, immutable' } });
    });
    const response = await worker.fetch(new Request(`https://site.example${pathname}?v=version`, { headers: { 'User-Agent': ua } }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), mime);
    assert.equal(response.headers.get('ETag'), '"v1"');
    assert.equal(response.headers.get('Last-Modified'), 'Thu, 10 Sep 2026 00:00:00 GMT');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    assert.deepEqual(calls, [`${origin === 'pages' ? env.GITHUB_PAGES_ORIGIN : env.RAW_CONTENT_ORIGIN}${pathname}?v=version`]);
    assert.doesNotMatch(response.headers.get('Cache-Control')!, /31536000|immutable/);
  });
}

test('conditional asset requests forward validators, never user credentials, and keep 304', async () => {
  mock.method(globalThis, 'fetch', (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('If-None-Match'), '"v1"');
    assert.equal(headers.get('If-Modified-Since'), 'Thu, 10 Sep 2026 00:00:00 GMT');
    for (const name of ['Cookie', 'Authorization', 'Referer', 'X-Backend-Key']) assert.equal(headers.get(name), null);
    return new Response(null, { status: 304, headers: { ETag: '"v1"', Vary: 'Accept-Encoding' } });
  });
  const response = await worker.fetch(new Request('https://site.example/assets/index-ABC123xy.js', { headers: {
    'If-None-Match': '"v1"', 'If-Modified-Since': 'Thu, 10 Sep 2026 00:00:00 GMT',
    Cookie: 'session=secret', Authorization: 'Bearer secret', Referer: 'https://private.example', 'X-Backend-Key': 'secret',
  } }), env);
  assert.equal(response.status, 304);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('ETag'), '"v1"');
  assert.equal(response.headers.get('Vary'), 'Accept-Encoding');
});

test('resource HEAD preserves content length and validator headers with no body', async () => {
  mock.method(globalThis, 'fetch', (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.method, 'HEAD');
    return new Response(null, { headers: { 'Content-Type': 'image/png', 'Content-Length': '120', ETag: '"png-v1"' } });
  });
  const response = await worker.fetch(new Request('https://site.example/images/a.png', { method: 'HEAD' }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Length'), '120');
  assert.equal(response.headers.get('ETag'), '"png-v1"');
  assert.equal(await response.text(), '');
});

test('range response stays 206 with Content-Range and unchanged bytes', async () => {
  mock.method(globalThis, 'fetch', (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('Range'), 'bytes=0-3');
    assert.equal(headers.get('If-Range'), '"v1"');
    return new Response('part', { status: 206, headers: { 'Content-Type': 'video/mp4', 'Content-Range': 'bytes 0-3/100', ETag: '"v1"' } });
  });
  const response = await worker.fetch(new Request('https://site.example/images/demo.mp4', { headers: { Range: 'bytes=0-3', 'If-Range': '"v1"' } }), env);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 0-3/100');
  assert.equal(await response.text(), 'part');
});

for (const status of [404, 403, 503]) {
  test(`resource origin status ${status} is preserved and not cached as success`, async () => {
    mock.method(globalThis, 'fetch', () => new Response('Origin failure', { status, headers: { 'Retry-After': '60' } }));
    const response = await worker.fetch(new Request('https://site.example/robots.txt', { headers: { 'User-Agent': 'Googlebot' } }), env);
    assert.equal(response.status, status);
    assert.equal(await response.text(), 'Origin failure');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Retry-After'), '60');
  });
}

test('HTML origin fallback cannot masquerade as JS, PNG or JSON', async () => {
  mock.method(globalThis, 'fetch', () => new Response('<html>fallback</html>', { headers: { 'Content-Type': 'text/html' } }));
  for (const pathname of ['/assets/app.js', '/images/a.png', '/posts-manifest.json']) {
    const response = await worker.fetch(new Request(`https://site.example${pathname}`), env);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('X-SEO-Error'), 'RESOURCE_RETURNED_HTML');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('only a missing MIME is supplemented', async () => {
  mock.method(globalThis, 'fetch', () => new Response(new Uint8Array([1, 2])));
  const response = await worker.fetch(new Request('https://site.example/images/a.png'), env);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
});

test('page HEAD strips shell-specific validators, keeps CSP and noncanonical Link', async () => {
  mock.method(globalThis, 'fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(inputUrl(input), `${env.GITHUB_PAGES_ORIGIN}/index.html`);
    assert.equal(init?.method, 'HEAD');
    assert.equal(new Headers(init?.headers).get('If-None-Match'), null);
    return new Response(null, { headers: { 'Content-Type': 'text/html', ETag: '"shared-shell"',
      'Last-Modified': 'Thu, 10 Sep 2026 00:00:00 GMT', 'Content-Length': '50',
      'Content-Security-Policy': "default-src 'none'", Link: '</app.js>; rel=preload; as=script, <https://old.example>; rel=canonical',
    } });
  });
  const response = await worker.fetch(new Request('https://site.example/projects', { method: 'HEAD', headers: { 'If-None-Match': '"shared-shell"' } }), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  for (const name of ['ETag', 'Last-Modified', 'Content-Length']) assert.equal(response.headers.get(name), null);
  assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'none'");
  assert.equal(response.headers.get('Link'), '</app.js>; rel=preload; as=script');
});

for (const ua of agents) {
  test(`page status: ${ua} missing public article vs origin failure`, async () => {
    const fetch = mock.method(globalThis, 'fetch', () => jsonResponse({ items: [post] }));
    let response = await worker.fetch(new Request('https://site.example/blog/2026/missing', { headers: { 'User-Agent': ua } }), env);
    assert.equal(response.status, 404);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore(); invalidateManifestCache();
    mock.method(globalThis, 'fetch', () => new Response('unavailable', { status: 503 }));
    response = await worker.fetch(new Request('https://site.example/blog/2026/sample-post', { headers: { 'User-Agent': ua } }), env);
    assert.equal(response.status, 503);
  });
}

test('a resolved page with missing or unavailable shell is not turned into a post 404', async () => {
  for (const status of [404, 503, 502]) {
    const fetch = mock.method(globalThis, 'fetch', () => new Response('no shell', { status }));
    const response = await worker.fetch(new Request('https://site.example/projects'), env);
    assert.equal(response.status, status === 404 ? 502 : status);
    fetch.mock.restore();
  }
});

test('alias and decomposed Unicode URLs redirect to their verified canonical only', async () => {
  mock.method(globalThis, 'fetch', () => jsonResponse({ items: [post, { ...post, slug: '한글' }] }));
  for (const pathname of ['/post/2026/sample-post', '/post/2026/sample-post/index.html', '/posts/2026/sample-post']) {
    const response = await worker.fetch(new Request(`https://site.example${pathname}?from=reader`), env);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('Location'), 'https://site.example/blog/2026/sample-post?from=reader');
  }
  const response = await worker.fetch(new Request(`https://site.example/blog/2026/${encodeURIComponent('한글'.normalize('NFD'))}`), env);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('Location'), `https://site.example/blog/2026/${encodeURIComponent('한글')}`);
});

test('unsafe input, unsupported methods and missing routes do not make origin calls', async () => {
  mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch'); });
  assert.equal((await worker.fetch(new Request('https://site.example/projects', { method: 'POST' }), env)).status, 405);
  assert.equal((await worker.fetch(new Request('https://site.example/blog/2026/%252F'), env)).status, 400);
  assert.equal((await worker.fetch(new Request('https://site.example/unknown-route'), env)).status, 404);
  const response = await worker.fetch(new Request('https://site.example/api/seo-debug?path=https://evil.test'), env);
  assert.equal(response.status, 400);
});

test('network/timeout produce retryable 5xx without exposing exception messages', async () => {
  for (const [name, status] of [['Error', 503], ['TimeoutError', 504]] as const) {
    const fetch = mock.method(globalThis, 'fetch', () => { const e = new Error('secret-internal-host'); e.name = name; throw e; });
    const response = await worker.fetch(new Request('https://site.example/robots.txt'), env);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Retry-After'), '30');
    assert.doesNotMatch(await response.text(), /secret/);
    fetch.mock.restore();
  }
});
