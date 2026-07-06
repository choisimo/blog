import { describe, expect, it } from 'vitest';
import { normalizeProviderApiBaseUrl } from '@/components/features/admin/ai/ProvidersManager';

describe('normalizeProviderApiBaseUrl', () => {
  it('allows clean HTTP(S) provider base URLs', () => {
    expect(normalizeProviderApiBaseUrl(' https://api.example.com/v1/ ')).toBe(
      'https://api.example.com/v1'
    );
    expect(normalizeProviderApiBaseUrl('http://localhost:11434/v1')).toBe(
      'http://localhost:11434/v1'
    );
  });

  it('treats empty provider base URLs as unset', () => {
    expect(normalizeProviderApiBaseUrl('')).toBeUndefined();
    expect(normalizeProviderApiBaseUrl('   ')).toBeUndefined();
    expect(normalizeProviderApiBaseUrl(null)).toBeUndefined();
  });

  it('rejects unsafe provider base URL forms', () => {
    expect(normalizeProviderApiBaseUrl('//api.example.com/v1')).toBeUndefined();
    expect(normalizeProviderApiBaseUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeProviderApiBaseUrl('ftp://api.example.com/v1')).toBeUndefined();
    expect(normalizeProviderApiBaseUrl('https://api.example.com/v1?debug=1')).toBeUndefined();
    expect(normalizeProviderApiBaseUrl('https://api.example.com/v1#models')).toBeUndefined();
    expect(normalizeProviderApiBaseUrl('https://api.example.com/\nv1')).toBeUndefined();
    expect(normalizeProviderApiBaseUrl('https://api.example.com\\v1')).toBeUndefined();
  });
});
