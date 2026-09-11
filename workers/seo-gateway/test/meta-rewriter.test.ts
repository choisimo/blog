import assert from 'node:assert/strict';
import test from 'node:test';
import { MetaTagRemover, HeadEndInjector } from '../src/meta-rewriter';
import type { PostMeta } from '../src/types';

// Recording elements exercise handler decisions, NOT the HTML parsing engine.
// Actual streamed HTMLRewriter execution is covered separately in test/runtime.
class RecordingElement {
  removed = false;
  appended: string[] = [];
  constructor(public tagName: string, private attributes: Record<string, string> = {}) {}
  getAttribute(name: string) { return this.attributes[name] ?? null; }
  remove() { this.removed = true; }
  append(content: string, options: { html: boolean }) {
    assert.equal(options.html, true);
    this.appended.push(content);
  }
}
const meta: PostMeta = {
  title: 'A < B & "quoted" </title><script>alert(1)</script>',
  description: 'safe "quoted" & <em>tag</em>', ogImage: 'https://image.example/a.png',
  url: 'https://site.example/blog/2026/test', type: 'article', tags: ['x', 'x', '<b>y</b>'],
};

test('owned metadata removal handles duplicate tags and case-insensitive values', () => {
  const remover = new MetaTagRemover();
  for (const [tag, attributes] of [
    ['title', {}], ['TITLE', {}], ['link', { rel: 'Canonical' }],
    ['link', { rel: 'alternate CANONICAL' }], ['meta', { name: 'DESCRIPTION' }],
    ['meta', { property: 'OG:title' }], ['meta', { name: 'Twitter:Card' }],
    ['meta', { property: 'article:tag' }],
  ] as Array<[string, Record<string, string>]>) {
    const element = new RecordingElement(tag, attributes);
    remover.element(element as unknown as Element);
    assert.equal(element.removed, true);
  }
});

test('unowned head elements and conservative robots policy are preserved', () => {
  const remover = new MetaTagRemover();
  for (const [tag, attributes] of [
    ['link', { rel: 'stylesheet' }], ['meta', { name: 'google-site-verification' }],
    ['meta', { name: 'robots', content: 'noindex' }],
    ['script', { type: 'application/ld+json' }], ['meta', { 'http-equiv': 'Content-Security-Policy' }],
  ] as Array<[string, Record<string, string>]>) {
    const element = new RecordingElement(tag, attributes);
    remover.element(element as unknown as Element);
    assert.equal(element.removed, false);
  }
});

test('head insertion emits one escaped title, description, canonical and unique article tags', () => {
  const element = new RecordingElement('head');
  const injector = new HeadEndInjector(meta, 'A & B');
  injector.element(element as unknown as Element);
  injector.element(element as unknown as Element);
  assert.equal(element.appended.length, 1);
  const html = element.appended[0];
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert.doesNotMatch(html, /<script>|<em>|<b>/);
  assert.match(html, /&lt;\/title&gt;/);
  assert.match(html, /&amp;/);
  assert.equal((html.match(/property="article:tag"/g) || []).length, 2);
  assert.doesNotMatch(html, /og:image:width/);
});

test('each request has a fresh injector; private pages replace indexable robots hints', () => {
  const first = new RecordingElement('head');
  const second = new RecordingElement('head');
  new HeadEndInjector(meta, 'Site').element(first as unknown as Element);
  new HeadEndInjector({ ...meta, title: 'Next title', type: 'website', noIndex: true }, 'Site').element(second as unknown as Element);
  assert.match(second.appended[0], /Next title/);
  assert.doesNotMatch(second.appended[0], /article:tag|alert\(1\)/);
  assert.match(second.appended[0], /name="robots" content="noindex, nofollow"/);
  const element = new RecordingElement('meta', { name: 'Googlebot', content: 'index' });
  new MetaTagRemover(true).element(element as unknown as Element);
  assert.equal(element.removed, true);
});
