import { describe, expect, it } from 'vitest';
import { bearerAuth } from '@/lib/auth';

describe('bearerAuth', () => {
  it('trims valid bearer tokens before building the Authorization header', () => {
    expect(bearerAuth(' token-123 ')).toEqual({
      Authorization: 'Bearer token-123',
    });
  });

  it('rejects blank, whitespace-bearing, control-character, and oversized tokens', () => {
    expect(() => bearerAuth('   ')).toThrow('Invalid bearer token');
    expect(() => bearerAuth('token value')).toThrow('Invalid bearer token');
    expect(() => bearerAuth('token\tvalue')).toThrow('Invalid bearer token');
    expect(() => bearerAuth('token\u0000value')).toThrow(
      'Invalid bearer token'
    );
    expect(() => bearerAuth('a'.repeat(4097))).toThrow(
      'Invalid bearer token'
    );
  });
});
