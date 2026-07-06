import { describe, expect, it } from 'vitest';
import { normalizeMarkdownLinkHref } from './MarkdownRenderer';

describe('MarkdownRenderer helpers', () => {
  it('sanitizes safe markdown href values before returning them', () => {
    expect(normalizeMarkdownLinkHref('\u001b[31mhttps://example.com/post\u0000')).toBe(
      'https://example.com/post'
    );
    expect(normalizeMarkdownLinkHref('#section')).toBe('#section');
    expect(normalizeMarkdownLinkHref('/blog/2026/post')).toBe('/blog/2026/post');
    expect(normalizeMarkdownLinkHref('mailto:person@example.com')).toBe(
      'mailto:person@example.com'
    );
  });

  it('rejects unsafe markdown href values', () => {
    expect(normalizeMarkdownLinkHref('javascript:alert(1)')).toBeUndefined();
    expect(normalizeMarkdownLinkHref('https://user:pass@example.com/post')).toBeUndefined();
    expect(normalizeMarkdownLinkHref('/blog/%2Fhidden')).toBeUndefined();
    expect(normalizeMarkdownLinkHref('/blog/%0Ahidden')).toBeUndefined();
    expect(normalizeMarkdownLinkHref('/blog/%zz')).toBeUndefined();
    expect(normalizeMarkdownLinkHref('\\windows\\path')).toBeUndefined();
  });
});
