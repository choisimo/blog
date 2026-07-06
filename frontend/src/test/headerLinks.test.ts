import { describe, expect, it } from 'vitest';

import { normalizeHeaderExploreHref } from '@/components/organisms/Header';

describe('Header explore link normalization', () => {
  it('accepts safe internal and external explore links', () => {
    expect(normalizeHeaderExploreHref('/projects')).toEqual({
      href: '/projects',
      external: false,
    });
    expect(normalizeHeaderExploreHref(' https://docs.nodove.com/ ')).toEqual({
      href: 'https://docs.nodove.com/',
      external: true,
    });
  });

  it('rejects unsafe explore links before rendering', () => {
    expect(normalizeHeaderExploreHref('//evil.example.com')).toBeNull();
    expect(normalizeHeaderExploreHref('/projects%09tab')).toBeNull();
    expect(normalizeHeaderExploreHref('https://user:pass@example.com/docs')).toBeNull();
    expect(normalizeHeaderExploreHref('javascript:alert(1)')).toBeNull();
  });
});
