import { afterEach, describe, expect, it, vi } from 'vitest';

import { sha256 } from '@/utils/fingerprint/hash';

const originalSubtle = crypto.subtle;

describe('fingerprint hash utility', () => {
  afterEach(() => {
    Object.defineProperty(crypto, 'subtle', {
      configurable: true,
      value: originalSubtle,
    });
    vi.restoreAllMocks();
  });

  it('fails closed for non-string runtime input', async () => {
    await expect(sha256(null as unknown as string)).resolves.toMatch(/^[0-9a-f]+$/);
    await expect(sha256(null as unknown as string)).resolves.toBe(await sha256(''));
  });

  it('uses the same bounded input for WebCrypto and fallback hashing', async () => {
    Object.defineProperty(crypto, 'subtle', {
      configurable: true,
      value: undefined,
    });
    const fallback = await sha256(`${'a'.repeat(200_000)}tail`);

    Object.defineProperty(crypto, 'subtle', {
      configurable: true,
      value: originalSubtle,
    });
    const bounded = await sha256('a'.repeat(200_000));

    Object.defineProperty(crypto, 'subtle', {
      configurable: true,
      value: undefined,
    });
    const boundedFallback = await sha256('a'.repeat(200_000));

    expect(fallback).toBe(boundedFallback);
    expect(bounded).toMatch(/^[0-9a-f]{64}$/);
  });
});
