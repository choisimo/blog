import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  generateSEOData,
  generateStructuredData,
  type SEOResolvedPost,
} from '@/utils/seo/seo';

describe('seo runtime resilience', () => {
  const originalLocation = window.location;

  const post: SEOResolvedPost = {
    year: '2024',
    slug: 'blade-runner-philosophy',
    date: '2024-12-17',
    author: 'nodove',
    category: 'Cinema',
    tags: ['film', 'philosophy'],
    title: 'Blade Runner and Philosophy',
    description: 'A test post for SEO runtime resilience.',
  };

  beforeEach(() => {
    delete (window as Window & { APP_CONFIG?: unknown }).APP_CONFIG;
    delete (window as Window & { __APP_CONFIG?: unknown }).__APP_CONFIG;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://noblog.nodove.com/'),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.unstubAllEnvs();
    delete (window as Window & { APP_CONFIG?: unknown }).APP_CONFIG;
    delete (window as Window & { __APP_CONFIG?: unknown }).__APP_CONFIG;
  });

  it('does not throw for public pages when runtime api config is unavailable', () => {
    expect(() => generateSEOData(undefined, 'home')).not.toThrow();
    expect(() => generateStructuredData(undefined, 'home')).not.toThrow();

    expect(generateSEOData(undefined, 'home').ogImage).toBe(
      'https://noblog.nodove.com/images/seo/default/seo.png'
    );
  });

  it('falls back to the static seo image for post metadata when api base is unavailable', () => {
    const seoData = generateSEOData(post, 'post');
    const structuredData = generateStructuredData(post, 'post') as { image: string };

    expect(seoData.ogImage).toBe('https://noblog.nodove.com/images/seo/default/seo.png');
    expect(structuredData.image).toBe('https://noblog.nodove.com/images/seo/default/seo.png');
  });
});
