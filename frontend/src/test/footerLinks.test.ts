import { describe, expect, it } from 'vitest';

import {
  buildFooterMailtoHref,
  normalizeFooterExternalHref,
} from '@/components/organisms/Footer';

describe('Footer link normalization helpers', () => {
  it('accepts normalized http and https social links', () => {
    expect(normalizeFooterExternalHref(' https://github.com/nodove ')).toBe(
      'https://github.com/nodove',
    );
    expect(normalizeFooterExternalHref('http://example.com/profile')).toBe(
      'http://example.com/profile',
    );
  });

  it('rejects unsafe social link protocols and encoded whitespace controls', () => {
    expect(normalizeFooterExternalHref('javascript:alert(1)')).toBeNull();
    expect(normalizeFooterExternalHref('data:text/html,hi')).toBeNull();
    expect(normalizeFooterExternalHref('https://example.com/bad path')).toBeNull();
    expect(normalizeFooterExternalHref('https://example.com/\nnext')).toBeNull();
    expect(normalizeFooterExternalHref('https://user:pass@example.com')).toBeNull();
  });

  it('builds only safe footer mailto links', () => {
    expect(buildFooterMailtoHref(' hello@example.com ')).toBe('mailto:hello@example.com');

    expect(buildFooterMailtoHref('bad@example.com?subject=x')).toBeNull();
    expect(buildFooterMailtoHref('bad\n@example.com')).toBeNull();
    expect(buildFooterMailtoHref('missing-at.example.com')).toBeNull();
  });
});
