import { describe, expect, it } from 'vitest';
import {
  getThumbSrc,
  normalizeManifestMediaPath,
  resolvePostMediaSrc,
} from '@/utils/content/postMedia';

describe('postMedia utils', () => {
  it('repairs legacy manifest image paths that were generated under /posts/<year>/images', () => {
    expect(
      normalizeManifestMediaPath('/posts/2026/images/2026/awk-1/1.png', '2026/awk-1')
    ).toBe('/images/2026/awk-1/1.png');
  });

  it('resolves root-style markdown images to public /images assets', () => {
    expect(resolvePostMediaSrc('images/2026/awk-1/1.png', '2026/awk-1')).toBe(
      '/images/2026/awk-1/1.png'
    );
  });

  it('skips thumbnail conversion for gifs and videos', () => {
    expect(getThumbSrc('/images/2026/awk-1/12.gif')).toBe('/images/2026/awk-1/12.gif');
    expect(getThumbSrc('/posts/2026/image/demo/clip.mp4')).toBe(
      '/posts/2026/image/demo/clip.mp4'
    );
  });
});
