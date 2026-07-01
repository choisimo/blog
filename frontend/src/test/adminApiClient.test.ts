import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRefreshAccessToken, mockState } = vi.hoisted(() => ({
  mockRefreshAccessToken: vi.fn(),
  mockState: {
    refreshToken: 'refresh-token',
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
  getApiBaseUrl: () => 'https://api.example.com',
}));

vi.mock('@/services/session/auth', () => ({
  refreshAccessToken: mockRefreshAccessToken,
}));

import { adminApiFetch, adminFetchRaw } from '@/services/admin/apiClient';

function authorizationHeader(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  const [, init] = fetchMock.mock.calls[index];
  return new Headers(init?.headers).get('Authorization');
}

describe('admin API client auth retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
