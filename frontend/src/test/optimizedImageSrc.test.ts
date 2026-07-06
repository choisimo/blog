import { describe, expect, it } from 'vitest';
import { resolveOptimizedImageSrc } from '@/components/common/OptimizedImage';

describe('resolveOptimizedImageSrc', () => {
  it('resolves root-relative and relative assets under the configured base URL', () => {
    expect(resolveOptimizedImageSrc('/images/cover.png', '/blog/')).toBe(
      '/blog/images/cover.png'
    );
    expect(resolveOptimizedImageSrc('images/cover.png', '/blog/')).toBe(
      '/blog/images/cover.png'
    );
    expect(resolveOptimizedImageSrc('/blog/images/cover.png', '/blog/')).toBe(
      '/blog/images/cover.png'
    );
  });

  it('allows explicit image source protocols', () => {
    expect(resolveOptimizedImageSrc('https://example.com/cover.png')).toBe(
      'https://example.com/cover.png'
    );
    expect(resolveOptimizedImageSrc('http://example.com/cover.png')).toBe(
      'http://example.com/cover.png'
    );
    expect(resolveOptimizedImageSrc('blob:https://example.com/id')).toBe(
      'blob:https://example.com/id'
    );
    expect(resolveOptimizedImageSrc('data:image/png;base64,abc')).toBe(
      'data:image/png;base64,abc'
    );
  });

  it('rejects unsafe or malformed image sources', () => {
    expect(resolveOptimizedImageSrc('javascript:alert(1)')).toBeNull();
    expect(resolveOptimizedImageSrc('ftp://example.com/cover.png')).toBeNull();
    expect(resolveOptimizedImageSrc('data:text/html;base64,abc')).toBeNull();
    expect(resolveOptimizedImageSrc('//example.com/cover.png')).toBeNull();
    expect(resolveOptimizedImageSrc('/images/\ncover.png')).toBeNull();
  });
});
