import { describe, expect, it } from 'vitest';
import { normalizeConfiguredApiBaseUrl } from '@/utils/network/apiBase';

describe('normalizeConfiguredApiBaseUrl', () => {
  it('normalizes supported http and https API base URLs', () => {
    expect(normalizeConfiguredApiBaseUrl(' https://api.example.com/api/ ')).toBe(
      'https://api.example.com'
    );
    expect(normalizeConfiguredApiBaseUrl('http://localhost:5080/')).toBe(
      'http://localhost:5080'
    );
    expect(
      normalizeConfiguredApiBaseUrl('https://ai-check.nodove.com/api')
    ).toBe('https://api.nodove.com');
  });

  it('rejects unsupported protocols and URL values with query or hash fragments', () => {
    expect(normalizeConfiguredApiBaseUrl('ftp://api.example.com')).toBeNull();
    expect(
      normalizeConfiguredApiBaseUrl('https://api.example.com?debug=true')
    ).toBeNull();
    expect(
      normalizeConfiguredApiBaseUrl('https://api.example.com#v1')
    ).toBeNull();
    expect(normalizeConfiguredApiBaseUrl('not-a-url')).toBeNull();
  });
});
