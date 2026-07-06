import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAuthHeaders,
  normalizeAuthStoreToken,
  useAuthStore,
} from '@/stores/session/useAuthStore';

vi.mock('@/services/session/auth', () => ({
  getTokenExpiration: vi.fn(() => Date.now() + 120_000),
  isTokenExpired: vi.fn(() => false),
  logout: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

describe('auth store token boundaries', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
    sessionStorage.clear();
  });

  it('normalizes valid persisted auth tokens', () => {
    expect(normalizeAuthStoreToken(' token-value ')).toBe('token-value');
  });

  it('rejects whitespace-bearing, control-character, encoded-newline, and oversized auth tokens', () => {
    expect(normalizeAuthStoreToken('token value')).toBeNull();
    expect(normalizeAuthStoreToken('token\tvalue')).toBeNull();
    expect(normalizeAuthStoreToken('token\u0000value')).toBeNull();
    expect(normalizeAuthStoreToken('token%0avalue')).toBeNull();
    expect(normalizeAuthStoreToken('a'.repeat(4097))).toBeNull();
  });

  it('clears invalid stored auth tokens before building sync auth headers', () => {
    useAuthStore.setState({
      accessToken: 'token%0avalue',
      refreshToken: 'refresh-token',
      user: null,
      isRefreshing: false,
    });

    expect(getAuthHeaders()).toEqual({ 'Content-Type': 'application/json' });
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });
});
