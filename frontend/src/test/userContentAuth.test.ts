import { describe, expect, it } from 'vitest';
import { normalizePrincipalSub } from '@/services/session/userContentAuth';

describe('normalizePrincipalSub', () => {
  it('trims valid principal subjects for header use', () => {
    expect(normalizePrincipalSub(' user-123 ')).toBe('user-123');
  });

  it('rejects blank, whitespace-bearing, control-character, encoded-newline, and oversized subjects', () => {
    expect(normalizePrincipalSub('   ')).toBeNull();
    expect(normalizePrincipalSub('user 123')).toBeNull();
    expect(normalizePrincipalSub('user\t123')).toBeNull();
    expect(normalizePrincipalSub('user\u0000123')).toBeNull();
    expect(normalizePrincipalSub('user%0a123')).toBeNull();
    expect(normalizePrincipalSub('a'.repeat(257))).toBeNull();
  });
});
