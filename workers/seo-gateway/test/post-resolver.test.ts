import assert from 'node:assert/strict';
import test, { beforeEach, afterEach, mock } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { resolvePostMeta, invalidateManifestCache } from '../src/post-resolver';
import { SeoGatewayError } from '../src/request-policy';
import { env, post, jsonResponse, inputUrl } from './helpers/fixtures';

beforeEach(() => invalidateManifestCache());
afterEach(() => mock.restoreAll());
const resolve = (pathname: string, config = env) => resolvePostMeta(new URL(pathname, env.SITE_BASE_URL), config);
const failWith = (status: number, code?: string) => (error: unknown) =>
  error instanceof SeoGatewayError && error.status === status && (!code || error.code === code);

test('projects and actual public routes have their own canonical without fetching manifests', async () => {
  mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected upstream'); });
  for (const pathname of ['/projects', '/about', '/debate', '/insight', '/blog']) {
    const meta = await resolve(pathname);
    assert.equal(meta.url, `${env.SITE_BASE_URL}${pathname}`);
    assert.equal(meta.type, 'website');
  }
  assert.equal((await resolve('/projects/')).url, `${env.SITE_BASE_URL}/projects`);
  assert.equal((await resolve('/contact')).url, `${env.SITE_BASE_URL}/about`);
  await assert.rejects(resolve('/nonexistent'), failWith(404));
});

test('unpublished article is not exposed; canonical aliases resolve the same public article', async () => {
  mock.method(globalThis, 'fetch', () => jsonResponse({ total: 2, items: [post, { ...post, slug: 'draft', published: false }] }));
  for (const prefix of ['blog', 'post', 'posts']) {
    const meta = await resolve(`/${prefix}/2026/sample-post`);
    assert.equal(meta.url, 'https://site.example/blog/2026/sample-post');
    assert.equal(meta.title, 'Sample post | Site');
  }
  await assert.rejects(resolve('/blog/2026/draft'), failWith(404, 'POST_NOT_FOUND'));
  await assert.rejects(resolve('/blog/2026/missing'), failWith(404));
});

test('encoded Korean, spaces, NFC and dotted titles resolve without fabricated slug titles', async () => {
  const slugs = ['감동을_잃어버린_그대들에게', 'Container Network Interface', '_index', 'node.js'];
  mock.method(globalThis, 'fetch', () => jsonResponse({ items: slugs.map(slug => ({ ...post, slug, title: `제목: ${slug}` })) }));
  for (const slug of slugs) {
    const meta = await resolve(`/blog/2026/${encodeURIComponent(slug.normalize('NFD'))}`);
    assert.equal(meta.title, `제목: ${slug} | Site`);
    assert.equal(meta.url, `https://site.example/blog/2026/${encodeURIComponent(slug)}`);
    assert.deepEqual(meta.tags, ['A', 'B']);
  }
});

test('supplied source manifest: every published post is resolvable (not a live-site probe)', async () => {
  const root = process.env.BLOG_SOURCE || path.resolve(process.cwd(), '../..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'frontend/public/posts-manifest.json'), 'utf8'));
  mock.method(globalThis, 'fetch', () => jsonResponse(manifest));
  const published = manifest.items.filter((item: { published?: boolean }) => item.published !== false);
  assert.ok(published.length > 0);
  for (const item of published) {
    const meta = await resolve(`/blog/${item.year}/${encodeURIComponent(item.slug)}`);
    assert.equal(meta.title, `${item.title} | Site`);
    assert.equal(meta.url, `https://site.example/blog/${item.year}/${encodeURIComponent(item.slug.normalize('NFC'))}`);
  }
});

for (const [status, expected] of [[404, 503], [503, 503], [502, 502], [504, 504], [301, 503]]) {
  test(`manifest status ${status} is not mistaken for deleted articles`, async () => {
    mock.method(globalThis, 'fetch', () => new Response('origin error', { status }));
    await assert.rejects(resolve('/blog/2026/sample-post'), failWith(expected));
  });
}

test('malformed/incomplete/ambiguous manifests fail closed without poisoning cache', async () => {
  const invalid = [null, {}, { items: [] , total: 4 }, { items: [post, post] },
    { items: [{ ...post, published: 'false' }] }, { items: [{ ...post, slug: '../x' }] }];
  for (const body of invalid) {
    invalidateManifestCache();
    const fetch = mock.method(globalThis, 'fetch', () => jsonResponse(body));
    await assert.rejects(resolve('/blog/2026/sample-post'), failWith(502));
    fetch.mock.restore();
  }
  mock.method(globalThis, 'fetch', () => jsonResponse({ items: [post] }));
  assert.equal((await resolve('/blog/2026/sample-post')).title, 'Sample post | Site');
});

test('manifest network failure and invalid JSON differ', async () => {
  const fetch = mock.method(globalThis, 'fetch', () => { throw new Error('network down'); });
  await assert.rejects(resolve('/blog/2026/sample-post'), failWith(503));
  fetch.mock.restore();
  mock.method(globalThis, 'fetch', () => new Response('<html>not JSON</html>'));
  await assert.rejects(resolve('/blog/2026/sample-post'), failWith(502));
});

test('manifest cache is bounded by TTL and scoped to the configured raw origin', async () => {
  let time = Date.now();
  let calls = 0;
  mock.method(Date, 'now', () => time);
  mock.method(globalThis, 'fetch', (input: RequestInfo | URL) => {
    calls += 1;
    const raw = inputUrl(input);
    assert.ok(raw.endsWith('/posts-manifest.json'));
    assert.ok(!raw.includes('?v='));
    if (calls === 4) return new Response('unavailable', { status: 503 });
    return jsonResponse({ items: [{ ...post, title: raw.includes('other') ? 'Other site' : 'Same site' }] });
  });
  await resolve('/blog/2026/sample-post');
  await resolve('/blog/2026/sample-post');
  assert.equal(calls, 1);
  assert.equal((await resolve('/blog/2026/sample-post', { ...env, RAW_CONTENT_ORIGIN: 'https://other.example' })).title, 'Other site | Site');
  time += 300_001;
  await resolve('/blog/2026/sample-post');
  assert.equal(calls, 3);
  time += 300_001;
  await assert.rejects(resolve('/blog/2026/sample-post'), failWith(503));
});

test('known admin and error routes remain available but not indexable', async () => {
  for (const pathname of ['/admin', '/admin/login', '/admin/auth/callback', '/admin/config/chat.js']) {
    const meta = await resolve(pathname);
    assert.equal(meta.noIndex, true);
    assert.equal(meta.httpStatus, undefined);
  }
  const meta = await resolve('/404');
  assert.equal(meta.noIndex, true);
  assert.equal(meta.httpStatus, 404);
});

test('custom images have no invented dimensions; unsafe image URLs use the existing OG fallback', async () => {
  const fetch = mock.method(globalThis, 'fetch', () => jsonResponse({ items: [{ ...post, coverImage: '/images/a.png' }] }));
  const custom = await resolve('/blog/2026/sample-post');
  assert.equal(custom.ogImage, 'https://site.example/images/a.png');
  assert.equal(custom.ogImageWidth, undefined);
  fetch.mock.restore(); invalidateManifestCache();
  mock.method(globalThis, 'fetch', () => jsonResponse({ items: [{ ...post, coverImage: 'javascript:alert(1)' }] }));
  const fallback = await resolve('/blog/2026/sample-post');
  assert.ok(fallback.ogImage.startsWith('https://api.example/api/v1/og?'));
  assert.equal(fallback.ogImageWidth, 1200);
});

test('resolver stays aligned with all declared frontend routes (admin shell remains private)', async () => {
  const root = process.env.BLOG_SOURCE || path.resolve(process.cwd(), '../..');
  const app = fs.readFileSync(path.join(root, 'frontend/src/App.tsx'), 'utf8');
  const routes = [...app.matchAll(/\bpath=["']([^"']+)["']/g)].map(match => match[1]).filter(value => value !== '*');
  assert.ok(routes.includes('/projects') && routes.includes('/blog/:year/:slug'));
  mock.method(globalThis, 'fetch', () => jsonResponse({ items: [post] }));
  for (const route of routes) {
    const pathname = route.replace(':year', '2026').replace(':slug', 'sample-post').replace(':section', 'chat').replace(':subtab', 'main');
    const meta = await resolve(pathname);
    assert.equal(meta.url.startsWith(env.SITE_BASE_URL + '/'), true, route);
    if (route.startsWith('/admin')) assert.equal(meta.noIndex, true, route);
  }
});
