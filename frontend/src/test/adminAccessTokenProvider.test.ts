import { beforeEach, describe, expect, it, vi } from 'vitest';

import { adminAccessTokenProvider } from '@/services/core/admin-access-token.provider';

const mocks = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(),
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  useAuthStore: {
    getState: () => ({
      getValidAccessToken: mocks.getValidAccessToken,
    }),
  },
}));

describe('admin access token provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trims valid access tokens before returning them', async () => {
    mocks.getValidAccessToken.mockResolvedValue(' admin-token ');

    await expect(adminAccessTokenProvider.getAccessToken()).resolves.toBe(
      'admin-token',
    );
  });

  it('fails closed for blank access tokens', async () => {
    mocks.getValidAccessToken.mockResolvedValue(' \n\t ');

    await expect(adminAccessTokenProvider.getAccessToken()).resolves.toBeNull();
  });

  it('fails closed for header-unsafe access tokens', async () => {
    mocks.getValidAccessToken.mockResolvedValue('admin-token\r\nX-Injected: yes');

    await expect(adminAccessTokenProvider.getAccessToken()).resolves.toBeNull();

    mocks.getValidAccessToken.mockResolvedValue('admin token');

    await expect(adminAccessTokenProvider.getAccessToken()).resolves.toBeNull();
  });

  it('fails closed for overlong access tokens', async () => {
    mocks.getValidAccessToken.mockResolvedValue('a'.repeat(4097));

    await expect(adminAccessTokenProvider.getAccessToken()).resolves.toBeNull();
  });

  it('fails closed when the auth store token lookup throws', async () => {
    mocks.getValidAccessToken.mockRejectedValue(new Error('refresh failed'));

    await expect(adminAccessTokenProvider.getAccessToken()).resolves.toBeNull();
  });
});
