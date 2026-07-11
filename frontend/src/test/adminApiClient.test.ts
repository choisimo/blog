import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetApiBaseUrl, mockRefreshAccessToken, mockState } = vi.hoisted(() => ({
  mockGetApiBaseUrl: vi.fn(),
  mockRefreshAccessToken: vi.fn(),
  mockState: {
    refreshToken: 'refresh-token' as string | null,
    getValidAccessToken: vi.fn(),
    setTokens: vi.fn(),
    clearAuth: vi.fn(),
  },
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  useAuthStore: {
    getState: () => mockState,
  },
}));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: mockGetApiBaseUrl,
}));

vi.mock('@/services/session/auth', () => ({
  refreshAccessToken: mockRefreshAccessToken,
}));

import { adminApiFetch, adminFetchRaw } from '@/services/admin/apiClient';

interface RefreshCredentials {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

function authorizationHeader(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  const [, init] = fetchMock.mock.calls[index];
  return new Headers(init?.headers).get('Authorization');
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('admin API client auth retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiBaseUrl.mockReset().mockReturnValue('https://api.example.com');
    mockState.refreshToken = 'refresh-token';
    mockState.getValidAccessToken.mockResolvedValue('old-access-token');
    mockRefreshAccessToken.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forces token refresh before retrying adminApiFetch after a 401', async () => {
    mockRefreshAccessToken.mockResolvedValueOnce({
      accessToken: '  new-access-token  ',
      refreshToken: '  new-refresh-token  ',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { saved: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminApiFetch<{ saved: boolean }>('/secrets', {
      pathPrefix: '/api/v1/admin',
      method: 'POST',
      body: { key: 'OPENAI_API_KEY' },
    });

    expect(result).toEqual({ ok: true, data: { saved: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authorizationHeader(fetchMock, 0)).toBe('Bearer old-access-token');
    expect(authorizationHeader(fetchMock, 1)).toBe('Bearer new-access-token');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Content-Type')).toBe(
      'application/json',
    );
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      JSON.stringify({ key: 'OPENAI_API_KEY' }),
    );
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('refresh-token');
    expect(mockState.setTokens).toHaveBeenCalledWith(
      'new-access-token',
      'new-refresh-token',
    );
    expect(mockState.clearAuth).not.toHaveBeenCalled();
  });

  it('does not force a JSON content type for bodyless adminApiFetch requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { providers: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminApiFetch<{ providers: unknown[] }>('/providers', {
      pathPrefix: '/api/v1/admin/ai',
    });

    expect(result).toEqual({ ok: true, data: { providers: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer old-access-token');
    expect(headers.get('Content-Type')).toBeNull();
    expect(init?.body).toBeUndefined();
  });

  it('fails adminApiFetch closed when the access token is polluted', async () => {
    mockState.getValidAccessToken.mockResolvedValue(
      'old-access-token\r\nX-Injected: yes',
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { saved: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminApiFetch<{ saved: boolean }>('/secrets', {
      pathPrefix: '/api/v1/admin',
    });

    expect(result).toEqual({
      ok: false,
      error: 'Not authenticated. Please log in again.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockState.clearAuth).toHaveBeenCalledTimes(1);
  });

  it('fails adminApiFetch closed when the access token contains internal whitespace', async () => {
    mockState.getValidAccessToken.mockResolvedValue('old access token');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { saved: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminApiFetch<{ saved: boolean }>('/secrets', {
      pathPrefix: '/api/v1/admin',
    });

    expect(result).toEqual({
      ok: false,
      error: 'Not authenticated. Please log in again.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockState.clearAuth).toHaveBeenCalledTimes(1);
  });

  it('rejects adminApiFetch endpoints containing encoded line endings before fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { saved: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminApiFetch<{ saved: boolean }>(
      '/secrets?next=%0D%0AX-Injected%3Ayes',
      {
        pathPrefix: '/api/v1/admin',
      },
    );

    expect(result).toEqual({ ok: false, error: 'Invalid admin API URL' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects adminApiFetch endpoints containing encoded controls before fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { saved: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminApiFetch<{ saved: boolean }>(
      '/secrets?next=%09tab',
      {
        pathPrefix: '/api/v1/admin',
      },
    );

    expect(result).toEqual({ ok: false, error: 'Invalid admin API URL' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes object-shaped adminApiFetch error responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'RATE_LIMITED' },
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminApiFetch<{ saved: boolean }>('/secrets', {
      pathPrefix: '/api/v1/admin',
    });

    expect(result).toEqual({ ok: false, error: 'RATE_LIMITED' });
  });

  it('falls back instead of returning unsafe adminApiFetch error messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: 'Rate limited\r\nX-Injected: yes' },
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminApiFetch<{ saved: boolean }>('/secrets', {
      pathPrefix: '/api/v1/admin',
    });

    expect(result).toEqual({ ok: false, error: 'Request failed (429)' });
  });

  it('normalizes unsafe API base URL setup errors instead of rejecting', async () => {
    mockGetApiBaseUrl.mockImplementationOnce(() => {
      throw new Error('Base URL failed\r\nX-Injected: yes');
    });

    await expect(adminApiFetch('/api/admin/example')).resolves.toEqual({
      ok: false,
      error: 'Network error',
    });
  });

  it('falls back when a local network Error message is unsafe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error(`Network failed\u0000${'x'.repeat(10_000)}`)),
    );

    const result = await adminApiFetch('/api/admin/example');

    expect(result).toEqual({
      ok: false,
      error: 'Network error',
    });
  });

  it('does not force refresh after a 401 when no access token was available', async () => {
    mockState.getValidAccessToken.mockResolvedValue(null);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await adminFetchRaw(
      'https://api.example.com/api/v1/admin/config/current',
    );

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authorizationHeader(fetchMock, 0)).toBeNull();
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    expect(mockState.setTokens).not.toHaveBeenCalled();
  });

  it('clears polluted raw admin tokens before making raw requests', async () => {
    mockState.getValidAccessToken.mockResolvedValue(
      'old-access-token\r\nX-Injected: yes',
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await adminFetchRaw(
      'https://api.example.com/api/v1/admin/config/current',
    );

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authorizationHeader(fetchMock, 0)).toBeNull();
    expect(mockState.clearAuth).toHaveBeenCalledTimes(1);
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('rejects raw admin URLs containing encoded line endings before fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      adminFetchRaw(
        'https://api.example.com/api/v1/admin/config/current?next=%0AInjected',
      ),
    ).rejects.toThrow('Invalid admin API URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects raw admin URLs containing encoded controls before fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      adminFetchRaw(
        'https://api.example.com/api/v1/admin/config/current?next=%09tab',
      ),
    ).rejects.toThrow('Invalid admin API URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects raw admin URLs outside the configured API origin before fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      adminFetchRaw('https://evil.example.com/api/v1/admin/config/current'),
    ).rejects.toThrow('Invalid admin API URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries adminFetchRaw with a refreshed token after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await adminFetchRaw(
      'https://api.example.com/api/v1/admin/config/current',
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authorizationHeader(fetchMock, 0)).toBe('Bearer old-access-token');
    expect(authorizationHeader(fetchMock, 1)).toBe('Bearer new-access-token');
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('refresh-token');
  });

  it('preserves logged-out auth when a stale forced refresh succeeds', async () => {
    const refreshDeferred = createDeferred<RefreshCredentials>();
    const refreshStarted = createDeferred<string>();
    mockRefreshAccessToken.mockImplementationOnce((refreshToken: string) => {
      refreshStarted.resolve(refreshToken);
      return refreshDeferred.promise;
    });
    const originalResponse = new Response('{}', { status: 401 });
    const fetchMock = vi.fn().mockResolvedValueOnce(originalResponse);
    vi.stubGlobal('fetch', fetchMock);

    const responsePromise = adminFetchRaw(
      'https://api.example.com/api/v1/admin/config/current',
    );

    await expect(refreshStarted.promise).resolves.toBe('refresh-token');
    mockState.refreshToken = null;
    refreshDeferred.resolve({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });

    const response = await responsePromise;

    expect(response).toBe(originalResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('refresh-token');
    expect(mockState.setTokens).not.toHaveBeenCalled();
    expect(mockState.clearAuth).not.toHaveBeenCalled();
    expect(mockState.refreshToken).toBeNull();
  });

  it('preserves replacement auth when a stale forced refresh rejects', async () => {
    const refreshDeferred = createDeferred<RefreshCredentials>();
    const refreshStarted = createDeferred<string>();
    mockRefreshAccessToken.mockImplementationOnce((refreshToken: string) => {
      refreshStarted.resolve(refreshToken);
      return refreshDeferred.promise;
    });
    const originalResponse = new Response('{}', { status: 401 });
    const fetchMock = vi.fn().mockResolvedValueOnce(originalResponse);
    vi.stubGlobal('fetch', fetchMock);

    const responsePromise = adminFetchRaw(
      'https://api.example.com/api/v1/admin/config/current',
    );

    await expect(refreshStarted.promise).resolves.toBe('refresh-token');
    mockState.refreshToken = 'replacement-refresh-token';
    refreshDeferred.reject(new Error('old refresh failed'));

    const response = await responsePromise;

    expect(response).toBe(originalResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('refresh-token');
    expect(mockState.setTokens).not.toHaveBeenCalled();
    expect(mockState.clearAuth).not.toHaveBeenCalled();
    expect(mockState.refreshToken).toBe('replacement-refresh-token');
  });

  it('clears auth instead of retrying with polluted refreshed tokens', async () => {
    mockRefreshAccessToken.mockResolvedValueOnce({
      accessToken: 'new-access-token\r\nX-Injected: yes',
      refreshToken: 'new-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await adminFetchRaw(
      'https://api.example.com/api/v1/admin/config/current',
    );

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockState.setTokens).not.toHaveBeenCalled();
    expect(mockState.clearAuth).toHaveBeenCalledTimes(1);
  });

  it('clears unchanged auth instead of retrying when forced refresh rejects', async () => {
    mockRefreshAccessToken.mockRejectedValueOnce(new Error('refresh failed'));
    const originalResponse = new Response('{}', { status: 401 });
    const fetchMock = vi.fn().mockResolvedValueOnce(originalResponse);
    vi.stubGlobal('fetch', fetchMock);

    const response = await adminFetchRaw(
      'https://api.example.com/api/v1/admin/config/current',
    );

    expect(response).toBe(originalResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockState.setTokens).not.toHaveBeenCalled();
    expect(mockState.clearAuth).toHaveBeenCalledTimes(1);
  });

  it('does not force a JSON content type for FormData adminFetchRaw requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.append('file', new Blob(['image']), 'cover.png');

    const response = await adminFetchRaw(
      'https://api.example.com/api/v1/images/upload-direct',
      {
        method: 'POST',
        body: formData,
      },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer old-access-token');
    expect(headers.get('Content-Type')).toBeNull();
    expect(init?.body).toBe(formData);
  });

  it('does not allow caller-supplied Authorization headers to override admin tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await adminFetchRaw(
      'https://api.example.com/api/v1/admin/config/current',
      {
        headers: { Authorization: 'Bearer caller-token' },
      },
    );

    expect(response.status).toBe(200);
    expect(authorizationHeader(fetchMock, 0)).toBe('Bearer old-access-token');
  });
});
