import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './loader.mjs';

const geometry = await loadSource('src/utils/content/imageGeometry.ts');
const media = await loadSource('src/utils/content/postMedia.ts');
const progress = await loadSource('src/utils/content/readingProgress.ts');
const { normalizeImageDimension, fitImageToViewport, constrainImageView, INITIAL_IMAGE_VIEW } = geometry;
const image = { width: 1600, height: 900 };
const viewport = { width: 800, height: 600 };

for (const [value, expected] of [[1200, 1200], ['900', 900], [' 640.5 ', 640.5], [0, undefined], [-1, undefined], [NaN, undefined], [Infinity, undefined], ['100%', undefined], ['120px', undefined], ['', undefined], [null, undefined], [100001, undefined]]) {
  test(`image dimensions: ${String(value)} -> ${expected}`, () => assert.equal(normalizeImageDimension(value), expected));
}
test('landscape image is fitted without cropping', () => assert.deepEqual(fitImageToViewport(image, viewport, 0), { width: 800, height: 450 }));
test('quarter-turn rotation fits the rotated bounds', () => assert.deepEqual(fitImageToViewport(image, viewport, 90), { width: 600, height: 337.5 }));
test('small images are not upscaled at fit', () => assert.deepEqual(fitImageToViewport({ width: 100, height: 200 }, viewport, 0), { width: 100, height: 200 }));
test('unknown or invalid dimensions never produce NaN', () => {
  for (const width of [0, -1, NaN, Infinity]) assert.deepEqual(fitImageToViewport({ width, height: 900 }, viewport, 0), { width: 0, height: 0 });
});
test('zoom bounds and rotation are normalized', () => {
  assert.equal(constrainImageView({ ...INITIAL_IMAGE_VIEW, scale: 12, rotation: 450 }, image, viewport).scale, 4);
  assert.equal(constrainImageView({ ...INITIAL_IMAGE_VIEW, scale: -2, rotation: -90 }, image, viewport).rotation, 270);
  assert.equal(constrainImageView({ ...INITIAL_IMAGE_VIEW, scale: -2 }, image, viewport).scale, .5);
});
test('panning cannot lose the image outside the viewing area', () => {
  assert.deepEqual(constrainImageView({ scale: 2, rotation: 0, x: 99999, y: -99999 }, image, viewport), { scale: 2, rotation: 0, x: 400, y: -150 });
  assert.deepEqual(constrainImageView({ ...INITIAL_IMAGE_VIEW, x: 800, y: 200 }, image, viewport), INITIAL_IMAGE_VIEW);
});
test('invalid transform and viewport recover to finite values', () => {
  const result = constrainImageView({ scale: NaN, rotation: Infinity, x: NaN, y: -Infinity }, image, { width: NaN, height: Infinity });
  assert.deepEqual(result, INITIAL_IMAGE_VIEW);
});
test('resize/rotation/zoom combinations keep the transform bounded and idempotent', () => {
  for (const width of [1, 240, 390, 800, 1440]) for (const height of [1, 320, 600, 1200]) {
    for (const rotation of [0, 90, 180, 270, -90, 720]) for (const scale of [.1, .5, 1, 1.15, 2, 4, 20]) {
      const bounds = { width, height };
      const next = constrainImageView({ scale, rotation, x: 1e6, y: -1e6 }, image, bounds);
      assert.ok(Object.values(next).every(Number.isFinite));
      assert.ok(next.scale >= .5 && next.scale <= 4);
      assert.deepEqual(constrainImageView(next, image, bounds), next);
    }
  }
});
for (const source of ['https://images.example.org/a.png', '/media/a.png', '/images/a.svg', '/images/a.gif', '/posts/2026/a.mp4', '/images/a.thumb.webp', 'data:image/png;base64,a', 'blob:sample']) {
  test(`no speculative thumbnail for ${source}`, () => {
    assert.equal(media.shouldUseThumb(source), false);
    assert.equal(media.getThumbSrc(source), source);
  });
}
test('generated thumbnail contract remains available for local raster assets', () => {
  assert.equal(media.getThumbSrc('/images/figure.png'), '/images/figure.thumb.webp');
  assert.equal(media.getThumbSrc('/posts/2026/figure.JPEG'), '/posts/2026/figure.thumb.webp');
});
test('thumbnail rewriting preserves query parameters and fragments byte-for-byte', () => {
  assert.equal(media.getThumbSrc('/images/figure.png?v=2.3#detail'), '/images/figure.thumb.webp?v=2.3#detail');
  assert.equal(media.getThumbSrc('/images/figure.png#detail?a.b'), '/images/figure.thumb.webp#detail?a.b');
});
test('media path normalization still blocks traversal', () => {
  assert.equal(media.normalizeManifestMediaPath('/images/%2e%2e/secret.png'), undefined);
  assert.equal(media.normalizeManifestMediaPath('/images/../secret.png'), undefined);
});
const { calculateReadingProgress: read } = progress;
test('long document progress retains the existing midpoint', () => assert.equal(read(500, 0, 1800, 800), 50));
test('article progress starts after the article header, not page decorations', () => assert.equal(read(200, 600, 2200, 800, 64), 0));
test('article progress completes at its end even when comments remain below', () => assert.equal(read(2000, 600, 2200, 800, 64), 100));
test('short, fully visible articles count as read without division by zero', () => assert.equal(read(0, 200, 400, 800, 64), 100));
test('short articles below the viewport are not marked read', () => assert.equal(read(0, 1000, 400, 800, 64), 0));
test('overscroll clamps the reading value to its valid range', () => {
  assert.equal(read(-500, 0, 1800, 800), 0);
  assert.equal(read(99999, 0, 1800, 800), 100);
});
test('invalid or empty reading geometry has a deterministic zero state', () => {
  assert.equal(read(NaN, 0, 1000, 800), 0);
  assert.equal(read(0, 0, 0, 800), 0);
  assert.equal(read(0, 0, 1000, 0), 0);
});
