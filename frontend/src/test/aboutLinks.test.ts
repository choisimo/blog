import { describe, expect, it } from 'vitest';
import {
  normalizeAboutEmailHref,
  normalizeAboutSocialHref,
} from '@/utils/aboutLinks';

describe('about link normalization', () => {
  it('allows safe HTTP(S) social links', () => {
    expect(normalizeAboutSocialHref(' https://github.com/nodove ')).toBe(
      'https://github.com/nodove'
    );
    expect(normalizeAboutSocialHref('http://example.com/profile')).toBe(
      'http://example.com/profile'
    );
  });

  it('rejects unsafe social links', () => {
    expect(normalizeAboutSocialHref('javascript:alert(1)')).toBeNull();
    expect(normalizeAboutSocialHref('//example.com/profile')).toBeNull();
    expect(normalizeAboutSocialHref('mailto:user@example.com')).toBeNull();
    expect(normalizeAboutSocialHref('https://example.com/\nprofile')).toBeNull();
    expect(normalizeAboutSocialHref(null)).toBeNull();
  });

  it('allows only valid email mailto links', () => {
    expect(normalizeAboutEmailHref(' user@example.com ')).toBe(
      'mailto:user@example.com'
    );
    expect(normalizeAboutEmailHref('user@example')).toBeNull();
    expect(normalizeAboutEmailHref('user@example.com\nbcc:x@example.com')).toBeNull();
    expect(normalizeAboutEmailHref(null)).toBeNull();
  });
});
