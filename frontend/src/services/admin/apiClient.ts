import { useAuthStore } from '@/stores/session/useAuthStore';
import { getApiBaseUrl } from '@/utils/network/apiBase';

interface AdminApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface AdminApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  pathPrefix?: string;
}

export async function adminApiFetch<T>(
  endpoint: string,
  options: AdminApiFetchOptions = {}
): Promise<AdminApiResult<T>> {
  const { getValidAccessToken, clearAuth } = useAuthStore.getState();
  const API_BASE = getApiBaseUrl();
  const { body, pathPrefix = '', ...fetchOptions } = options;

  try {
    const token = await getValidAccessToken();
    if (!token) {
      return { ok: false, error: 'Not authenticated. Please log in again.' };
    }

    const url = `${API_BASE}${pathPrefix}${endpoint}`;
    const init: RequestInit = {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...((fetchOptions.headers as Record<string, string>) || {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };

    let res = await fetch(url, init);

    if (res.status === 401) {
      const newToken = await getValidAccessToken();
      if (!newToken) {
        clearAuth();
        return { ok: false, error: 'Session expired. Please log in again.' };
      }

      const retryInit: RequestInit = {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...((fetchOptions.headers as Record<string, string>) || {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      };
      res = await fetch(url, retryInit);
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

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    },
  });
}
