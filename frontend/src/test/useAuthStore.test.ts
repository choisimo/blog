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

  it.each(['resolves', 'rejects'] as const)(
    'clears local auth immediately and preserves replacement auth when a stale logout %s',
    async completion => {
      mockGetTokenExpiration.mockReturnValue(null);

      let resolveLogout: () => void = () => {};
      let rejectLogout: (reason?: unknown) => void = () => {};
      const remoteLogout = new Promise<void>((resolve, reject) => {
        resolveLogout = resolve;
        rejectLogout = reject;
      });
      let authAtRemoteCall: Record<string, unknown> = {};
      mockLogout.mockImplementation(() => {
        const { accessToken, refreshToken, user, isRefreshing } =
          useAuthStore.getState();
        authAtRemoteCall = { accessToken, refreshToken, user, isRefreshing };
        return remoteLogout;
      });

      const oldUser = {
        username: 'old-admin',
        email: 'old-admin@example.com',
        role: 'admin',
        emailVerified: true,
      };
      useAuthStore
        .getState()
        .setTokens('old-access', 'old-refresh', oldUser);
      useAuthStore.setState({ isRefreshing: true });

      const logout = useAuthStore.getState().logout();

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockLogout).toHaveBeenCalledWith('old-refresh');
      expect(authAtRemoteCall).toEqual({
        accessToken: null,
        refreshToken: null,
        user: null,
        isRefreshing: false,
      });
      expect(useAuthStore.getState()).toMatchObject({
        accessToken: null,
        refreshToken: null,
        user: null,
        isRefreshing: false,
      });
      expect(JSON.parse(sessionStorage.getItem('admin.auth') ?? '{}')).toMatchObject({
        state: {
          accessToken: null,
          refreshToken: null,
          user: null,
        },
      });

      const replacementUser = {
        username: 'replacement-admin',
        email: 'replacement-admin@example.com',
        role: 'admin',
        emailVerified: true,
      };
      useAuthStore
        .getState()
        .setTokens(
          'replacement-access',
          'replacement-refresh',
          replacementUser,
        );

      if (completion === 'resolves') {
        resolveLogout();
        await expect(logout).resolves.toBeUndefined();
      } else {
        rejectLogout(new Error('old logout failed'));
        await expect(logout).rejects.toThrow('old logout failed');
      }

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState()).toMatchObject({
        accessToken: 'replacement-access',
        refreshToken: 'replacement-refresh',
        user: replacementUser,
        isRefreshing: false,
      });
      expect(JSON.parse(sessionStorage.getItem('admin.auth') ?? '{}')).toMatchObject({
        state: {
          accessToken: 'replacement-access',
          refreshToken: 'replacement-refresh',
          user: replacementUser,
        },
      });
    },
  );

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

  it('preserves replacement auth when a stale store-managed refresh rejects', async () => {
    mockGetTokenExpiration.mockReturnValue(null);
    mockIsTokenExpired.mockImplementation((token: string) => token === 'old-access');

    let rejectRefresh: (reason?: unknown) => void = () => {};
    mockRefreshAccessToken.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRefresh = reject;
      }),
    );

    useAuthStore
      .getState()
      .setTokens('old-access', 'old-refresh', {
        username: 'old-admin',
        email: 'old-admin@example.com',
        role: 'admin',
        emailVerified: true,
      });

    const refresh = useAuthStore.getState().getValidAccessToken();

    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('old-refresh');

    const replacementUser = {
      username: 'replacement-admin',
      email: 'replacement-admin@example.com',
      role: 'admin',
      emailVerified: true,
    };
    useAuthStore
      .getState()
      .setTokens(
        'replacement-access',
        'replacement-refresh',
        replacementUser,
      );

    rejectRefresh(new Error('old refresh failed'));

    await expect(refresh).resolves.toBeNull();
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'replacement-access',
      refreshToken: 'replacement-refresh',
      user: replacementUser,
      isRefreshing: false,
    });
    expect(JSON.parse(sessionStorage.getItem('admin.auth') ?? '{}')).toMatchObject({
      state: {
        accessToken: 'replacement-access',
        refreshToken: 'replacement-refresh',
        user: replacementUser,
      },
    });
    expect(getAuthHeaders()).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer replacement-access',
    });
    await expect(
      useAuthStore.getState().getValidAccessToken(),
    ).resolves.toBe('replacement-access');
    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('clears current auth when the active store-managed refresh rejects', async () => {
    mockGetTokenExpiration.mockReturnValue(null);
    mockIsTokenExpired.mockImplementation((token: string) => token === 'old-access');

    let rejectRefresh: (reason?: unknown) => void = () => {};
    mockRefreshAccessToken.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRefresh = reject;
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

    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('old-refresh');

    rejectRefresh(new Error('active refresh failed'));

    await expect(refresh).resolves.toBeNull();
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      refreshToken: null,
      user: null,
      isRefreshing: false,
    });
    expect(JSON.parse(sessionStorage.getItem('admin.auth') ?? '{}')).toMatchObject({
      state: {
        accessToken: null,
        refreshToken: null,
        user: null,
      },
    });
    expect(getAuthHeaders()).toEqual({
      'Content-Type': 'application/json',
    });
    await expect(
      useAuthStore.getState().getValidAccessToken(),
    ).resolves.toBeNull();
    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('normalizes refresh-result tokens before storing, scheduling, and returning access token', async () => {
    mockGetTokenExpiration.mockReturnValue(null);
    mockIsTokenExpired.mockImplementation((token: string) => token === 'old-access');
    mockRefreshAccessToken.mockResolvedValue({
      accessToken: '  new-access  ',
      refreshToken: '  new-refresh  ',
      tokenType: 'Bearer',
      expiresIn: 900,
    });

    useAuthStore.getState().setTokens('old-access', 'old-refresh');
    mockGetTokenExpiration.mockClear();

    await expect(
      useAuthStore.getState().getValidAccessToken(),
    ).resolves.toBe('new-access');
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      isRefreshing: false,
    });
    expect(JSON.parse(sessionStorage.getItem('admin.auth') ?? '{}')).toMatchObject({
      state: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      },
    });
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('old-refresh');
    expect(mockGetTokenExpiration).toHaveBeenCalledTimes(1);
    expect(mockGetTokenExpiration).toHaveBeenCalledWith('new-access');
  });

  it.each([
    ['blank access token', '   ', 'new-refresh'],
    ['blank refresh token', 'new-access', '   '],
    ['whitespace-bearing access token', 'new access', 'new-refresh'],
    ['whitespace-bearing refresh token', 'new-access', 'new refresh'],
    ['control-character access token', 'new-access\u0000', 'new-refresh'],
    ['control-character refresh token', 'new-access', 'new\u0000refresh'],
    ['encoded-newline access token', 'new-access%0Ainjected', 'new-refresh'],
    ['encoded-newline refresh token', 'new-access', 'new-refresh%0dinjected'],
  ])(
    'clears auth and returns null for a refresh result with %s',
    async (_case, accessToken, refreshToken) => {
      mockGetTokenExpiration.mockReturnValue(null);
      mockIsTokenExpired.mockImplementation((token: string) => token === 'old-access');
      mockRefreshAccessToken.mockResolvedValue({
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      });

      useAuthStore
        .getState()
        .setTokens('old-access', 'old-refresh', {
          username: 'admin',
          email: 'admin@example.com',
          role: 'admin',
          emailVerified: true,
        });
      mockGetTokenExpiration.mockClear();

      await expect(
        useAuthStore.getState().getValidAccessToken(),
      ).resolves.toBeNull();
      expect(useAuthStore.getState()).toMatchObject({
        accessToken: null,
        refreshToken: null,
        user: null,
        isRefreshing: false,
      });
      expect(JSON.parse(sessionStorage.getItem('admin.auth') ?? '{}')).toMatchObject({
        state: {
          accessToken: null,
          refreshToken: null,
          user: null,
        },
      });
      expect(mockRefreshAccessToken).toHaveBeenCalledWith('old-refresh');
      expect(mockGetTokenExpiration).not.toHaveBeenCalled();
    },
  );

  it('does not clear replacement auth when a stale refresh result is invalid', async () => {
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

    useAuthStore.getState().setTokens('old-access', 'old-refresh');
    const refresh = useAuthStore.getState().getValidAccessToken();

    useAuthStore
      .getState()
      .setTokens('replacement-access', 'replacement-refresh');
    resolveRefresh({
      accessToken: 'invalid access',
      refreshToken: 'invalid-refresh',
    });

    await expect(refresh).resolves.toBeNull();
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'replacement-access',
      refreshToken: 'replacement-refresh',
      isRefreshing: false,
    });
  });

  it('accepts normalized opaque tokens, stores them, and schedules refresh', () => {
    mockGetTokenExpiration.mockReturnValue(null);

    const accepted = useAuthStore
      .getState()
      .setTokens('  access-token  ', '  refresh-token  ');

    expect(accepted).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('access-token');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-token');
    expect(mockGetTokenExpiration).toHaveBeenCalledWith('access-token');
    expect(getAuthHeaders()).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer access-token',
    });
  });

  it('reports OAuth acceptance, stores normalized opaque tokens, and schedules refresh', () => {
    mockGetTokenExpiration.mockReturnValue(null);

    const accepted = useAuthStore
      .getState()
      .setTokensFromOAuth('  oauth-access-token  ', '  oauth-refresh-token  ');

    expect(accepted).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('oauth-access-token');
    expect(useAuthStore.getState().refreshToken).toBe('oauth-refresh-token');
    expect(mockGetTokenExpiration).toHaveBeenCalledWith('oauth-access-token');
    expect(getAuthHeaders()).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer oauth-access-token',
    });
  });

  it('reports OAuth rejection and clears existing auth state', () => {
    mockGetTokenExpiration.mockReturnValue(null);
    useAuthStore
      .getState()
      .setTokensFromOAuth('old-access-token', 'old-refresh-token');
    mockGetTokenExpiration.mockClear();

    const accepted = useAuthStore
      .getState()
      .setTokensFromOAuth('oauth access token', 'oauth-refresh-token');

    expect(accepted).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(mockGetTokenExpiration).not.toHaveBeenCalled();
    expect(getAuthHeaders()).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it.each([
    ['blank refresh token', 'access-token', '   '],
    ['embedded whitespace', 'access token', 'refresh-token'],
    ['control character', 'access-token\u0000', 'refresh-token'],
    ['encoded newline', 'access-token%0Ainjected', 'refresh-token'],
  ])(
    'reports rejection and clears auth for %s',
    (_case, accessToken, refreshToken) => {
      const accepted = useAuthStore
        .getState()
        .setTokens(accessToken, refreshToken);

      expect(accepted).toBe(false);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().refreshToken).toBeNull();
      expect(mockGetTokenExpiration).not.toHaveBeenCalled();
      expect(getAuthHeaders()).toEqual({
        'Content-Type': 'application/json',
      });
    },
  );

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
