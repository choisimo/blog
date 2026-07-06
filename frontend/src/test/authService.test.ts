import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: vi.fn(() => 'https://api.example.com'),
}));

import {
  consumeOAuthHandoff,
  getMe,
  getStoredAnonymousToken,
  getTotpSetup,
  getValidAnonymousToken,
  refreshAccessToken,
  refreshAnonymousToken,
  storeAnonymousToken,
  verifyTotpSetup,
} from '@/services/session/auth';

describe('auth service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('fails closed when the current-user response is missing a valid user object', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {},
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(getMe('admin-access-token')).rejects.toThrow(
      'Failed to get user info',
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-access-token',
        }),
      }),
    );
  });

  it('does not fetch current-user info with a blank bearer token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(getMe('   ')).rejects.toThrow('Invalid bearer token');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('trims optional TOTP setup tokens before sending headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { setupComplete: false },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      getTotpSetup('  setup-token  ', '  admin-access-token  '),
    ).resolves.toMatchObject({ setupComplete: false });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/auth/totp/setup',
      expect.objectContaining({
        headers: {
          'Setup-Token': 'setup-token',
          Authorization: 'Bearer admin-access-token',
        },
      }),
    );
  });

  it('rejects unsafe optional setup tokens before network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(getTotpSetup('setup-token\r\nX-Injected: yes')).rejects.toThrow(
      'Invalid setup token',
    );
    await expect(verifyTotpSetup('123456', 'setup token')).rejects.toThrow(
      'Invalid setup token',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('omits blank optional TOTP setup tokens', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { setupComplete: true },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(verifyTotpSetup('123456', '   ')).resolves.toMatchObject({
      setupComplete: true,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/auth/totp/setup/verify',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('normalizes refresh and OAuth handoff tokens before network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            tokenType: 'Bearer',
            expiresIn: 900,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(refreshAccessToken(' refresh-token ')).resolves.toMatchObject({
      accessToken: 'access-token',
    });
    await expect(consumeOAuthHandoff(' handoff-token ')).resolves.toMatchObject({
      accessToken: 'access-token',
    });

    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      refreshToken: 'refresh-token',
    });
    expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({
      handoff: 'handoff-token',
    });
  });

  it('clears unsafe stored anonymous tokens before reuse', () => {
    localStorage.setItem('anon.token', 'stored-token\r\nX-Injected: yes');

    expect(getStoredAnonymousToken()).toBeNull();
    expect(localStorage.getItem('anon.token')).toBeNull();
  });

  it('stores anonymous tokens only when they are header safe', () => {
    storeAnonymousToken(' safe-token ');
    expect(localStorage.getItem('anon.token')).toBe('safe-token');

    storeAnonymousToken('unsafe token');
    expect(localStorage.getItem('anon.token')).toBe('safe-token');
  });

  it('fails closed when anonymous token responses are malformed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            token: 'anon-token\r\nX-Injected: yes',
            expiresAt: '2030-01-01T00:00:00.000Z',
            userId: 'anon-user',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(getValidAnonymousToken()).rejects.toThrow(
      'Failed to get anonymous token',
    );
    expect(localStorage.getItem('anon.token')).toBeNull();
  });

  it('refreshes anonymous tokens with normalized bearer tokens', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            token: 'new-anon-token',
            expiresAt: '2030-01-01T00:00:00.000Z',
            userId: 'anon-user',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(refreshAnonymousToken(' old-anon-token ')).resolves.toEqual({
      token: 'new-anon-token',
      expiresAt: '2030-01-01T00:00:00.000Z',
      userId: 'anon-user',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/auth/anonymous/refresh',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer old-anon-token',
        }),
      }),
    );
  });
});
