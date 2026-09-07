import { describe, expect, it } from 'vitest';

import {
  getMarkdownLinkPresentation,
  getMarkdownRenderPolicy,
  normalizeMarkdownHrefForProfile,
  normalizeMarkdownSource,
  resolveMarkdownMediaPath,
} from './markdownPolicy';

describe('markdownPolicy', () => {
  it('keeps incomplete Markdown byte-stable after transport normalization', () => {
    expect(normalizeMarkdownSource('a\r\n```ts\r\nconst x = 1;\u0000')).toBe(
      'a\n```ts\nconst x = 1;',
    );
    expect(normalizeMarkdownSource('partial **bold and `code')).toBe(
      'partial **bold and `code',
    );
  });

  it('separates public navigation from inert preview behavior', () => {
    expect(getMarkdownLinkPresentation('https://example.com/a', 'article')).toEqual({
      href: 'https://example.com/a',
      interactive: true,
      external: true,
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    expect(getMarkdownLinkPresentation('https://example.com/a', 'preview')).toEqual({
      href: 'https://example.com/a',
      interactive: false,
      external: true,
      target: undefined,
      rel: undefined,
    });
    expect(getMarkdownRenderPolicy('preview').allowIframe).toBe(false);
  });

  it('keeps historic article-relative links but rejects executable and malformed URLs', () => {
    expect(normalizeMarkdownHrefForProfile('../next', 'article')).toBe('../next');
    expect(normalizeMarkdownHrefForProfile('https://example.com', 'article')).toBe(
      'https://example.com',
    );
    expect(normalizeMarkdownHrefForProfile('https://example.com', 'preview')).toBe(
      'https://example.com',
    );
    expect(normalizeMarkdownHrefForProfile('https://example.com', 'comment')).toBe(
      'https://example.com',
    );
    expect(normalizeMarkdownHrefForProfile('https://example.com', 'chat')).toBe(
      'https://example.com/',
    );
    expect(normalizeMarkdownHrefForProfile('next', 'chat')).toBeNull();
    expect(normalizeMarkdownHrefForProfile('javascript:alert(1)', 'article')).toBeNull();
    expect(normalizeMarkdownHrefForProfile('/a/%2fhidden', 'article')).toBeNull();
    expect(normalizeMarkdownHrefForProfile('/../admin', 'comment')).toBeNull();
  });

  it('resolves legacy and year-relative media paths consistently', () => {
    expect(resolveMarkdownMediaPath('image.png', '2026/post')).toBe(
      '/posts/2026/image.png',
    );
    expect(resolveMarkdownMediaPath('../images/cover.webp', '2026/post')).toBe(
      '/images/cover.webp',
    );
    expect(resolveMarkdownMediaPath('./posts/2025/demo.mp4', '2026/post')).toBe(
      '/posts/2025/demo.mp4',
    );
    expect(
      resolveMarkdownMediaPath('/posts/2025/images/legacy.webp', '2026/post'),
    ).toBe('/images/legacy.webp');
    expect(resolveMarkdownMediaPath('../secret.png', '2026/post')).toBeNull();
    expect(resolveMarkdownMediaPath('asset%2fhidden.png', '2026/post')).toBeNull();
  });
});
