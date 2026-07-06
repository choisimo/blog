import { describe, expect, it } from 'vitest';
import { normalizeSkipLinkHref } from '@/components/common/SkipLink';

describe('normalizeSkipLinkHref', () => {
  it('allows valid local hash anchors', () => {
    expect(normalizeSkipLinkHref('#main-content')).toBe('#main-content');
    expect(normalizeSkipLinkHref(' #article:body ')).toBe('#article:body');
    expect(normalizeSkipLinkHref('#section_2')).toBe('#section_2');
  });

  it('falls back for non-hash or malformed skip targets', () => {
    expect(normalizeSkipLinkHref('')).toBe('#main-content');
    expect(normalizeSkipLinkHref('#')).toBe('#main-content');
    expect(normalizeSkipLinkHref('/blog')).toBe('#main-content');
    expect(normalizeSkipLinkHref('https://example.com')).toBe('#main-content');
    expect(normalizeSkipLinkHref('javascript:alert(1)')).toBe('#main-content');
    expect(normalizeSkipLinkHref('#main content')).toBe('#main-content');
    expect(normalizeSkipLinkHref('#main\ncontent')).toBe('#main-content');
  });
});
