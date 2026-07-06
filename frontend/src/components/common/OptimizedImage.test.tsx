import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OptimizedImage, resolveOptimizedImageSrc } from './OptimizedImage';

let imageResult: 'idle' | 'load' | 'error' = 'idle';

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private currentSrc = '';

  set src(value: string) {
    this.currentSrc = value;

    if (imageResult === 'load') {
      this.onload?.();
    }

    if (imageResult === 'error') {
      this.onerror?.();
    }
  }

  get src() {
    return this.currentSrc;
  }
}

describe('OptimizedImage', () => {
  beforeEach(() => {
    imageResult = 'idle';
    vi.stubGlobal('Image', MockImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sanitizes image alt text while preserving image props', () => {
    render(
      <OptimizedImage
        src='/image.png'
        alt={'\u001b]0;Hidden alt\u0007\u001b[31mProfile photo\u0000'}
        width={320}
        height={180}
        className='custom-image'
        loading='eager'
      />
    );

    const image = screen.getByAltText('Profile photo');

    expect(image).toHaveAttribute('width', '320');
    expect(image).toHaveAttribute('height', '180');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveClass('custom-image');
    expect(image.getAttribute('alt')).not.toContain('Hidden');
    expect(image.getAttribute('alt')).not.toContain('\u001b');
  });

  it('sanitizes the error fallback accessibility label', async () => {
    imageResult = 'error';
    const onError = vi.fn();

    render(
      <OptimizedImage
        src='/missing.png'
        alt={'\u001b]0;Hidden alt\u0007\u001b[32mBroken image\u0007'}
        width={100}
        height={80}
        loading='eager'
        onError={onError}
      />
    );

    const fallback = await screen.findByRole('img', {
      name: '이미지를 불러올 수 없습니다: Broken image',
    });

    expect(fallback).toHaveStyle({ width: '100px', height: '80px' });
    expect(fallback.getAttribute('aria-label')).not.toContain('Hidden');
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('resolveOptimizedImageSrc', () => {
  it('keeps safe image sources and rejects unsafe values', () => {
    expect(resolveOptimizedImageSrc('/image.png', '/blog')).toBe('/blog/image.png');
    expect(resolveOptimizedImageSrc('/blog/image.png', '/blog')).toBe('/blog/image.png');
    expect(resolveOptimizedImageSrc('https://example.com/image.png')).toBe(
      'https://example.com/image.png'
    );
    expect(resolveOptimizedImageSrc('data:image/png;base64,abc')).toBe(
      'data:image/png;base64,abc'
    );
    expect(resolveOptimizedImageSrc('javascript:alert(1)')).toBeNull();
    expect(resolveOptimizedImageSrc('//example.com/image.png')).toBeNull();
    expect(resolveOptimizedImageSrc('/image\u0000.png')).toBeNull();
  });
});
