import { describe, expect, it } from 'vitest';
import { normalizeVisitRefererHost } from '@/components/features/admin/analytics/PostMetricsDetail';

describe('normalizeVisitRefererHost', () => {
  it('returns hostnames for safe HTTP(S) referers', () => {
    expect(normalizeVisitRefererHost(' https://example.com/path ')).toBe(
      'example.com'
    );
    expect(normalizeVisitRefererHost('http://sub.example.com/path')).toBe(
      'sub.example.com'
    );
  });

  it('fails closed for unsafe or malformed referers', () => {
    expect(normalizeVisitRefererHost(null)).toBe('—');
    expect(normalizeVisitRefererHost('')).toBe('—');
    expect(normalizeVisitRefererHost('/relative/path')).toBe('—');
    expect(normalizeVisitRefererHost('//example.com/path')).toBe('—');
    expect(normalizeVisitRefererHost('javascript:alert(1)')).toBe('—');
    expect(normalizeVisitRefererHost('https://example.com/\npath')).toBe('—');
    expect(normalizeVisitRefererHost('https://example.com/%0Apath')).toBe('—');
  });
});
