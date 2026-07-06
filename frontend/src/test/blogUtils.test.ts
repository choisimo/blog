import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadPostBySlug } from '@/utils/content/blog';

describe('blog content utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unsafe post slugs before fetching markdown', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(loadPostBySlug('../secrets')).resolves.toBeNull();
    await expect(loadPostBySlug('2026/%2e%2e/secrets')).resolves.toBeNull();
    await expect(loadPostBySlug('2026/post%09tab')).resolves.toBeNull();
    await expect(loadPostBySlug('https://example.com/post')).resolves.toBeNull();

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
