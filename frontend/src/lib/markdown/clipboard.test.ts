import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeTextToClipboard } from './clipboard';

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'execCommand');
});

describe('writeTextToClipboard', () => {
  it('reports success only after the clipboard promise resolves', async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => {
      resolve = done;
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(() => pending) },
    });

    let settled = false;
    const result = writeTextToClipboard('exact\nsource').then((value) => {
      settled = true;
      return value;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    resolve();
    await expect(result).resolves.toBe(true);
  });

  it('returns false when clipboard and fallback both reject', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => false),
    });
    await expect(writeTextToClipboard('source')).resolves.toBe(false);
  });
});
