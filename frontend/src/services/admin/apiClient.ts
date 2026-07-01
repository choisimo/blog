import { useAuthStore } from '@/stores/session/useAuthStore';
import { getApiBaseUrl } from '@/utils/network/apiBase';
import { bearerAuth } from '@/lib/auth';
import { refreshAccessToken } from '@/services/session/auth';

interface AdminApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface AdminApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  pathPrefix?: string;
}

function buildAdminHeaders(
  token: string | null,
  headers?: HeadersInit,
): Headers {
  const nextHeaders = new Headers(headers);
  if (!nextHeaders.has('Content-Type')) {
    nextHeaders.set('Content-Type', 'application/json');
  }
  if (token) {
    nextHeaders.set('Authorization', bearerAuth(token).Authorization);
  }
  return nextHeaders;
}

async function forceRefreshAdminAccessToken(): Promise<string | null> {
  const { refreshToken, clearAuth } = useAuthStore.getState();
  if (!refreshToken) {
    clearAuth();
    return null;
  }

  try {
    const result = await refreshAccessToken(refreshToken);
    useAuthStore
      .getState()
      .setTokens(result.accessToken, result.refreshToken);
    return result.accessToken;
  } catch {
    clearAuth();
    return null;
  }
}

function buildAdminRequestInit(
  options: RequestInit,
  token: string | null,
  body?: unknown,
): RequestInit {
  return {
    ...options,
    headers: buildAdminHeaders(token, options.headers),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

export async function adminApiFetch<T>(
  endpoint: string,
  options: AdminApiFetchOptions = {}
): Promise<AdminApiResult<T>> {
  const { getValidAccessToken } = useAuthStore.getState();
  const API_BASE = getApiBaseUrl();
  const { body, pathPrefix = '', ...fetchOptions } = options;

  try {
    const token = await getValidAccessToken();
    if (!token) {
      return { ok: false, error: 'Not authenticated. Please log in again.' };
    }

    const url = `${API_BASE}${pathPrefix}${endpoint}`;
    let res = await fetch(url, buildAdminRequestInit(fetchOptions, token, body));

    if (res.status === 401) {
      const newToken = await forceRefreshAdminAccessToken();
      if (!newToken) {
        return { ok: false, error: 'Session expired. Please log in again.' };
      }

      res = await fetch(url, buildAdminRequestInit(fetchOptions, newToken, body));
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        error: json?.error?.message || json?.error || `Request failed (${res.status})`,
      };
    }

    return { ok: true, data: json.data as T };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function adminFetchRaw(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { getValidAccessToken } = useAuthStore.getState();
  const token = await getValidAccessToken();

  let res = await fetch(url, buildAdminRequestInit(options, token));

  if (res.status === 401) {
    const newToken = await forceRefreshAdminAccessToken();
    if (newToken) {
      res = await fetch(url, buildAdminRequestInit(options, newToken));
    }
  }

  return res;
}
