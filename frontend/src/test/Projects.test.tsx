import { describe, expect, it } from 'vitest';
import { normalizeProjectsPageUrl } from '@/pages/public/Projects';

describe('normalizeProjectsPageUrl', () => {
  it('allows only http, https, and site-relative project urls', () => {
    expect(normalizeProjectsPageUrl(' https://example.com/project ')).toBe(
      'https://example.com/project'
    );
    expect(normalizeProjectsPageUrl('http://example.com')).toBe(
      'http://example.com/'
    );
    expect(normalizeProjectsPageUrl('/projects/demo')).toBe('/projects/demo');
    expect(normalizeProjectsPageUrl('//example.com/demo')).toBeUndefined();
    expect(normalizeProjectsPageUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeProjectsPageUrl('data:text/html,hello')).toBeUndefined();
    expect(normalizeProjectsPageUrl('example.com')).toBeUndefined();
  });
});
