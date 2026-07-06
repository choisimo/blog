import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCanvasFingerprint } from '@/utils/fingerprint/canvas';

function createMockContext(): Partial<CanvasRenderingContext2D> {
  return {
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    }) as unknown as CanvasGradient),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
  };
}

describe('canvas fingerprint utility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails closed when 2d canvas context is unavailable', async () => {
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => null,
    } as unknown as HTMLCanvasElement);

    await expect(getCanvasFingerprint()).resolves.toBe('');
  });

  it('fails closed when canvas serialization returns a non-string value', async () => {
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => createMockContext(),
      toDataURL: () => null,
    } as unknown as HTMLCanvasElement);

    await expect(getCanvasFingerprint()).resolves.toBe('');
  });

  it('hashes a serialized canvas payload when rendering succeeds', async () => {
    vi.spyOn(document, 'createElement').mockReturnValue({
      getContext: () => createMockContext(),
      toDataURL: () => 'data:image/png;base64,canvas-payload',
    } as unknown as HTMLCanvasElement);

    await expect(getCanvasFingerprint()).resolves.toMatch(/^[0-9a-f]+$/);
  });
});
