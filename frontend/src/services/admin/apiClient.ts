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

const MAX_ADMIN_TOKEN_LENGTH = 4096;
const MAX_ADMIN_URL_LENGTH = 4096;
const MAX_ADMIN_ERROR_LENGTH = 500;
const ADMIN_CLIENT_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const ENCODED_ADMIN_CLIENT_CONTROL_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;

function normalizeAdminClientString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (
    !normalized ||
    ADMIN_CLIENT_CONTROL_PATTERN.test(normalized) ||
    ENCODED_ADMIN_CLIENT_CONTROL_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function normalizeAdminToken(token: string | null | undefined): string | null {
  const normalized = normalizeAdminClientString(token);
  if (!normalized || normalized.length > MAX_ADMIN_TOKEN_LENGTH || /\s/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeAdminUrl(value: string, expectedBaseUrl?: string): string {
  const normalized = normalizeAdminClientString(value);
  if (!normalized || normalized.length > MAX_ADMIN_URL_LENGTH) {
    throw new Error('Invalid admin API URL');
  }

  if (expectedBaseUrl) {
    try {
      const base = new URL(expectedBaseUrl);
      const parsed = new URL(normalized, base.origin);
      if (parsed.origin !== base.origin) {
        throw new Error('Invalid admin API URL');
      }
    } catch {
      throw new Error('Invalid admin API URL');
    }
  }

  return normalized;
}

function buildAdminHeaders(
  token: string | null,
  headers?: HeadersInit,
  requestBody?: unknown,
): Headers {
  const nextHeaders = new Headers(headers);
  nextHeaders.delete('Authorization');
  const isFormDataBody =
    typeof FormData !== 'undefined' && requestBody instanceof FormData;
  const hasRequestBody = requestBody !== undefined && requestBody !== null;
  if (hasRequestBody && !nextHeaders.has('Content-Type') && !isFormDataBody) {
    nextHeaders.set('Content-Type', 'application/json');
  }
  const normalizedToken = normalizeAdminToken(token);
  if (normalizedToken) {
    nextHeaders.set('Authorization', bearerAuth(normalizedToken).Authorization);
  }
  return nextHeaders;
}

function normalizeAdminErrorMessage(value: unknown): string | null {
  const normalized = normalizeAdminClientString(value);
  if (!normalized || normalized.length > MAX_ADMIN_ERROR_LENGTH) {
    return null;
  }
  return normalized;
}

function getAdminApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as { error?: unknown; message?: unknown };
  const error = normalizeAdminErrorMessage(record.error);
  if (error) return error;
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as { message?: unknown; code?: unknown };
    const message = normalizeAdminErrorMessage(nested.message);
    const code = normalizeAdminErrorMessage(nested.code);
    if (message) return message;
    if (code) return code;
  }
  const message = normalizeAdminErrorMessage(record.message);
  if (message) return message;
  return fallback;
}

async function forceRefreshAdminAccessToken(): Promise<string | null> {
  const { refreshToken, clearAuth } = useAuthStore.getState();
  const normalizedRefreshToken = normalizeAdminToken(refreshToken);
  if (!normalizedRefreshToken) {
    clearAuth();
    return null;
  }

  try {
    const result = await refreshAccessToken(normalizedRefreshToken);
    const normalizedAccessToken = normalizeAdminToken(result.accessToken);
    const nextRefreshToken = normalizeAdminToken(result.refreshToken);
    if (!normalizedAccessToken || !nextRefreshToken) {
      clearAuth();
      return null;
    }
    useAuthStore
      .getState()
      .setTokens(normalizedAccessToken, nextRefreshToken);
    return normalizedAccessToken;
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
  const requestBody = body !== undefined ? body : options.body;
  const isFormDataBody =
    typeof FormData !== 'undefined' && requestBody instanceof FormData;

  return {
    ...options,
    headers: buildAdminHeaders(token, options.headers, requestBody),
    ...(body !== undefined
      ? { body: isFormDataBody ? (body as BodyInit) : JSON.stringify(body) }
      : {}),
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
    const rawToken = await getValidAccessToken();
    const token = normalizeAdminToken(rawToken);
    if (!token) {
      if (rawToken) useAuthStore.getState().clearAuth();
      return { ok: false, error: 'Not authenticated. Please log in again.' };
    }

    const normalizedPrefix = pathPrefix ? normalizeAdminUrl(pathPrefix) : '';
    const normalizedEndpoint = normalizeAdminUrl(endpoint);
    const url = normalizeAdminUrl(`${API_BASE}${normalizedPrefix}${normalizedEndpoint}`);
    let res = await fetch(url, buildAdminRequestInit(fetchOptions, token, body));

    if (res.status === 401 && token) {
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
        error: getAdminApiErrorMessage(json, `Request failed (${res.status})`),
      };
    }

    return { ok: true, data: json.data as T };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? normalizeAdminErrorMessage(err.message) ?? 'Network error' : 'Network error',
    };
  }
}

export async function adminFetchRaw(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const API_BASE = getApiBaseUrl();
  const { getValidAccessToken } = useAuthStore.getState();
  const rawToken = await getValidAccessToken();
  const token = normalizeAdminToken(rawToken);
  if (rawToken && !token) {
    useAuthStore.getState().clearAuth();
  }
  const normalizedUrl = normalizeAdminUrl(url, API_BASE);

  let res = await fetch(normalizedUrl, buildAdminRequestInit(options, token));

  if (res.status === 401 && token) {
    const newToken = await forceRefreshAdminAccessToken();
    if (newToken) {
      res = await fetch(normalizedUrl, buildAdminRequestInit(options, newToken));
    }
  }

  return res;
}
