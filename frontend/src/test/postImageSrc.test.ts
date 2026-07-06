import { describe, expect, it } from 'vitest';
import { normalizePostImageSrc } from '@/components/common/PostImage';

describe('normalizePostImageSrc', () => {
  it('allows common image source forms', () => {
    expect(normalizePostImageSrc(' https://example.com/cover.png ')).toBe(
      'https://example.com/cover.png'
    );
    expect(normalizePostImageSrc('http://example.com/cover.png')).toBe(
      'http://example.com/cover.png'
    );
    expect(normalizePostImageSrc('blob:https://example.com/id')).toBe(
      'blob:https://example.com/id'
    );
    expect(normalizePostImageSrc('data:image/webp;base64,abc')).toBe(
      'data:image/webp;base64,abc'
    );
    expect(normalizePostImageSrc('/images/cover.png')).toBe('/images/cover.png');
    expect(normalizePostImageSrc('images/cover.png')).toBe('images/cover.png');
  });

  it('rejects unsafe or malformed image source forms', () => {
    expect(normalizePostImageSrc(undefined)).toBeNull();
    expect(normalizePostImageSrc('')).toBeNull();
    expect(normalizePostImageSrc('javascript:alert(1)')).toBeNull();
    expect(normalizePostImageSrc('ftp://example.com/cover.png')).toBeNull();
    expect(normalizePostImageSrc('data:text/html;base64,abc')).toBeNull();
    expect(normalizePostImageSrc('//example.com/cover.png')).toBeNull();
    expect(normalizePostImageSrc('/images/\ncover.png')).toBeNull();
  });
});
