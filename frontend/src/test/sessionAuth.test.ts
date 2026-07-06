import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAnonymousToken,
  getStoredAnonymousToken,
  normalizeHeaderToken,
  storeAnonymousToken,
} from '@/services/session/auth';

const ANON_TOKEN_KEY = 'anon.token';

describe('session auth token boundaries', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAnonymousToken();
  });

  afterEach(() => {
    clearAnonymousToken();
    window.localStorage.clear();
  });

  it('rejects encoded newline markers in header tokens', () => {
    expect(normalizeHeaderToken('token-value')).toBe('token-value');
    expect(normalizeHeaderToken('token%0avalue')).toBeNull();
    expect(normalizeHeaderToken('token%0Dvalue')).toBeNull();
  });

  it('removes stored anonymous tokens that fail encoded-newline normalization', () => {
    window.localStorage.setItem(ANON_TOKEN_KEY, 'token%0avalue');

    expect(getStoredAnonymousToken()).toBeNull();
    expect(window.localStorage.getItem(ANON_TOKEN_KEY)).toBeNull();
  });

  it('does not store invalid anonymous tokens with encoded newlines', () => {
    storeAnonymousToken('token%0dvalue');

    expect(window.localStorage.getItem(ANON_TOKEN_KEY)).toBeNull();
  });
});
