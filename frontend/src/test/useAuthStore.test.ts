import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetTokenExpiration,
  mockIsTokenExpired,
  mockLogout,
  mockRefreshAccessToken,
} = vi.hoisted(() => ({
  mockGetTokenExpiration: vi.fn(),
  mockIsTokenExpired: vi.fn(),
  mockLogout: vi.fn(),
  mockRefreshAccessToken: vi.fn(),
}));

vi.mock('@/services/session/auth', () => ({
  getTokenExpiration: mockGetTokenExpiration,
  isTokenExpired: mockIsTokenExpired,
  logout: mockLogout,
  refreshAccessToken: mockRefreshAccessToken,
}));

import { getAuthHeaders, useAuthStore } from '@/stores/session/useAuthStore';

describe('useAuthStore', () => {
  afterEach(() => {
    useAuthStore.getState().clearAuth();
    mockGetTokenExpiration.mockReset();
    mockIsTokenExpired.mockReset();
    mockLogout.mockReset();
    mockRefreshAccessToken.mockReset();
    sessionStorage.clear();
  });

  it('does not restore tokens when an in-flight refresh resolves after auth was cleared', async () => {
    mockGetTokenExpiration.mockReturnValue(null);
    mockIsTokenExpired.mockImplementation((token: string) => token === 'old-access');

    let resolveRefresh: (
      value: { accessToken: string; refreshToken: string },
    ) => void = () => {};
    mockRefreshAccessToken.mockReturnValue(
      new Promise(resolve => {
        resolveRefresh = resolve;
      }),
    );

    useAuthStore
      .getState()
      .setTokens('old-access', 'old-refresh', {
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        emailVerified: true,
      });

    const refresh = useAuthStore.getState().getValidAccessToken();

    expect(mockRefreshAccessToken).toHaveBeenCalledWith('old-refresh');

    useAuthStore.getState().clearAuth();
    resolveRefresh({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    await expect(refresh).resolves.toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it('normalizes tokens before storing them and creating auth headers', () => {
    mockGetTokenExpiration.mockReturnValue(null);

    useAuthStore
      .getState()
      .setTokens('  access-token  ', '  refresh-token  ');

    expect(useAuthStore.getState().accessToken).toBe('access-token');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-token');
    expect(getAuthHeaders()).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer access-token',
    });
  });

  it('clears auth instead of storing invalid tokens', () => {
    useAuthStore.getState().setTokens('access-token', '   ');

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(getAuthHeaders()).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('clears polluted persisted tokens before creating auth headers', () => {
    useAuthStore.setState({
      accessToken: 'access-token\r\nX-Injected: yes',
      refreshToken: 'refresh-token',
      user: null,
      isRefreshing: false,
    });

    expect(getAuthHeaders()).toEqual({
      'Content-Type': 'application/json',
    });
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });
});
