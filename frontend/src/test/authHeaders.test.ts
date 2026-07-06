import { describe, expect, it } from 'vitest';

import { bearerAuth } from '@/lib/auth';

describe('auth headers', () => {
  it('trims bearer tokens before creating the Authorization header', () => {
    expect(bearerAuth('  admin-access-token  ')).toEqual({
      Authorization: 'Bearer admin-access-token',
    });
  });

  it('rejects blank bearer tokens before they reach fetch headers', () => {
    expect(() => bearerAuth('   ')).toThrow('Invalid bearer token');
  });

  it('rejects bearer tokens containing header-breaking line endings', () => {
    expect(() => bearerAuth('admin-token\r\nX-Injected: yes')).toThrow(
      'Invalid bearer token',
    );
  });
});
