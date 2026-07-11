import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: vi.fn(() => 'https://api.example.com'),
}));

import {
  consumeOAuthHandoff,
  getMe,
  getStoredAnonymousToken,
  getTotpSetup,
  getTotpSetupStatus,
  getValidAnonymousToken,
  initiateTotpChallenge,
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

  it('normalizes raw TOTP challenge errors to a bounded single line', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: '  Challenge\tlocked\r\nTry   again  ',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(initiateTotpChallenge()).rejects.toThrow(
      'Challenge locked Try again',
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/auth/totp/challenge',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });

  it('normalizes nested TOTP challenge error messages to a single line', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { message: 'Request\u2028blocked\u0000by policy' },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(initiateTotpChallenge()).rejects.toThrow(
      'Request blocked by policy',
    );
  });

  it('uses the fallback and enforces the TOTP challenge error length bound', async () => {
    const errorAtLimit = 'x'.repeat(256);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: false, error: { message: '\r\n\t' } }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error: errorAtLimit }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: false, error: 'x'.repeat(257) }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    await expect(initiateTotpChallenge()).rejects.toThrow(
      'Failed to get challenge',
    );
    await expect(initiateTotpChallenge()).rejects.toThrow(errorAtLimit);
    await expect(initiateTotpChallenge()).rejects.toThrow(
      'Failed to get challenge',
    );
  });

  it('normalizes native TOTP challenge fetch rejection messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('  Network\tblocked\r\nProxy\u2028detail  '),
    );

    await expect(initiateTotpChallenge()).rejects.toThrow(
      'Network blocked Proxy detail',
    );
  });

  it('uses the fallback for unsafe or non-Error TOTP challenge fetch rejections', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('x'.repeat(257)))
      .mockRejectedValueOnce('socket closed\r\ninternal detail');

    await expect(initiateTotpChallenge()).rejects.toThrow(
      'Failed to get challenge',
    );
    await expect(initiateTotpChallenge()).rejects.toThrow(
      'Failed to get challenge',
    );
  });

  it('preserves the fixed invalid-JSON TOTP challenge error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not-json', {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(initiateTotpChallenge()).rejects.toThrow('Invalid response');
  });

  it('normalizes raw TOTP setup status errors to a bounded single line', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: '  Status\tlookup\r\nfailed\u2028Try   again  ',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(getTotpSetupStatus()).rejects.toThrow(
      'Status lookup failed Try again',
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/auth/totp/status',
    );
  });

  it('normalizes nested TOTP setup status error messages to a single line', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { message: 'Status\u2028blocked\u0000by policy' },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(getTotpSetupStatus()).rejects.toThrow(
      'Status blocked by policy',
    );
  });

  it('uses the fallback and enforces the TOTP setup status error length bound', async () => {
    const errorAtLimit = 'x'.repeat(256);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: false, error: { message: '\r\n\t' } }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error: errorAtLimit }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: { message: 'x'.repeat(257) },
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    await expect(getTotpSetupStatus()).rejects.toThrow(
      'Failed to load TOTP setup status',
    );
    await expect(getTotpSetupStatus()).rejects.toThrow(errorAtLimit);
    await expect(getTotpSetupStatus()).rejects.toThrow(
      'Failed to load TOTP setup status',
    );
  });

  it('normalizes native TOTP setup status fetch rejection messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('  Status\tlookup\r\nblocked\u2028Try   again  '),
    );

    await expect(getTotpSetupStatus()).rejects.toThrow(
      'Status lookup blocked Try again',
    );
  });

  it('uses the fallback for unsafe or non-Error TOTP setup status fetch rejections', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('   '))
      .mockRejectedValueOnce(new TypeError('\r\n\u0000\u2028'))
      .mockRejectedValueOnce(new TypeError('x'.repeat(257)))
      .mockRejectedValueOnce('socket closed\r\ninternal detail');

    await expect(getTotpSetupStatus()).rejects.toThrow(
      'Failed to load TOTP setup status',
    );
    await expect(getTotpSetupStatus()).rejects.toThrow(
      'Failed to load TOTP setup status',
    );
    await expect(getTotpSetupStatus()).rejects.toThrow(
      'Failed to load TOTP setup status',
    );
    await expect(getTotpSetupStatus()).rejects.toThrow(
      'Failed to load TOTP setup status',
    );
  });

  it('preserves valid TOTP setup status data and fixed invalid-JSON errors', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: { setupComplete: false, requiresSetupToken: true },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
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
      )
      .mockResolvedValueOnce(
        new Response('not-json', {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await expect(getTotpSetupStatus()).resolves.toEqual({
      setupComplete: false,
      requiresSetupToken: true,
    });
    await expect(getTotpSetupStatus()).resolves.toEqual({
      setupComplete: true,
    });
    await expect(getTotpSetupStatus()).rejects.toThrow('Invalid response');
  });

  it.each([
    ['missing setupComplete', {}],
    ['string setupComplete', { setupComplete: 'false' }],
    ['numeric setupComplete', { setupComplete: 1 }],
    ['null setupComplete', { setupComplete: null }],
    ['array data', []],
    ['primitive data', 'false'],
  ])('rejects claimed-success TOTP setup status with %s', async (_case, data) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(getTotpSetupStatus()).rejects.toThrow('Invalid response');
  });

  it('preserves the HTTP status and existing message for failed current-user responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { message: 'Current session rejected' },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(getMe('admin-access-token')).rejects.toMatchObject({
      message: 'Current session rejected',
      status: 403,
    });
  });

  it('preserves the HTTP status when a failed current-user response is invalid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not-json', {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(getMe('admin-access-token')).rejects.toMatchObject({
      message: 'Invalid response',
      status: 503,
    });
  });

  it('preserves valid current-user responses', async () => {
    const user = {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      emailVerified: true,
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { user },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(getMe('admin-access-token')).resolves.toEqual(user);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-access-token',
        }),
      }),
    );
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
    const setup = {
      setupComplete: false,
      requiresToken: true,
      qrDataUrl: 'data:image/png;base64,qr',
      secret: 'totp-secret',
      otpauthUri: 'otpauth://totp/noblog:admin',
      futureField: { preserved: true },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: setup,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      getTotpSetup('  setup-token  ', '  admin-access-token  '),
    ).resolves.toEqual(setup);
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

  it('preserves a valid completed TOTP setup discriminator', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
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

    await expect(getTotpSetup('setup-token')).resolves.toEqual({
      setupComplete: true,
    });
  });

  it.each([
    ['string', 'true'],
    ['number', 1],
    ['object', { claimed: true }],
    ['array', [true]],
  ])(
    'rejects claimed-success TOTP setup with truthy %s setupComplete',
    async (_case, setupComplete) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            data: { setupComplete },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      await expect(getTotpSetup('setup-token')).rejects.toThrow(
        'Invalid response',
      );
    },
  );

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

  it('rejects claimed-success TOTP setup verification when setupComplete is false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
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

    await expect(verifyTotpSetup('123456', 'setup-token')).rejects.toThrow(
      'Setup verification failed',
    );
  });

  it('preserves TOTP setup verification when setupComplete is exactly true', async () => {
    const response = { setupComplete: true, message: 'Setup complete' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: response,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      verifyTotpSetup('123456', 'setup-token'),
    ).resolves.toEqual(response);
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
