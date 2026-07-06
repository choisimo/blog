/**
 * Admin Authentication Service
 *
 * TOTP + OAuth2 Authentication Flow:
 * - TOTP: initiateTotpChallenge() → verifyTotpCode() → tokens
 * - OAuth: redirect to /api/v1/auth/oauth/{github|google} → callback
 *
 * Features:
 * - Access token (15min) / Refresh token (7 days)
 * - Auto token refresh before expiration
 * - Secure token storage with Zustand persist
 */

import { getApiBaseUrl } from '@/utils/network/apiBase';
import { bearerAuth } from '@/lib/auth';

// ============================================================================
// Types
// ============================================================================

export interface TotpChallengeResponse {
  challengeId: string;
}

export interface TotpVerifyResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    username: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

export interface TotpSetupResponse {
  otpauthUri?: string;
  qrDataUrl?: string;
  secret?: string;
  setupComplete: boolean;
  requiresToken?: boolean;
}

export interface TotpSetupStatusResponse {
  setupComplete: boolean;
  requiresSetupToken?: boolean;
}

export interface TotpSetupVerifyResponse {
  setupComplete: boolean;
  message?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export type OAuthHandoffResponse = TotpVerifyResponse;

export interface UserInfo {
  username: string;
  email: string;
  role: string;
  emailVerified: boolean;
}

type ApiErrorPayload =
  | string
  | {
      code?: string;
      message?: string;
    };

const MAX_AUTH_TOKEN_LENGTH = 4096;
const MAX_AUTH_USER_FIELD_LENGTH = 256;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiErrorPayload;
}

function isUserInfo(value: unknown): value is UserInfo {
  if (!value || typeof value !== 'object') return false;
  const user = value as UserInfo;
  return Boolean(
    normalizeSafeText(user.username, MAX_AUTH_USER_FIELD_LENGTH) &&
    normalizeSafeText(user.email, MAX_AUTH_USER_FIELD_LENGTH) &&
    normalizeSafeText(user.role, MAX_AUTH_USER_FIELD_LENGTH) &&
    typeof user.emailVerified === 'boolean'
  );
}

function normalizeSafeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || CONTROL_CHAR_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

export function normalizeHeaderToken(token: unknown): string | null {
  if (typeof token !== 'string') return null;
  const value = token.trim();
  if (
    !value ||
    value.length > MAX_AUTH_TOKEN_LENGTH ||
    /\s/.test(value) ||
    CONTROL_CHAR_PATTERN.test(value) ||
    /%(?:0a|0d)/i.test(value)
  ) {
    return null;
  }
  return value;
}

function normalizeOptionalToken(token: string | undefined): string | null {
  if (typeof token !== 'string') return null;
  if (!token.trim()) return null;
  return normalizeHeaderToken(token);
}

function requireHeaderToken(token: unknown, message = 'Invalid bearer token'): string {
  const normalized = normalizeHeaderToken(token);
  if (!normalized) throw new Error(message);
  return normalized;
}

function normalizeAnonymousTokenResponse(value: unknown): AnonymousTokenResponse | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as AnonymousTokenResponse;
  const token = normalizeHeaderToken(record.token);
  const expiresAt = normalizeSafeText(record.expiresAt, MAX_AUTH_USER_FIELD_LENGTH);
  const userId = normalizeSafeText(record.userId, MAX_AUTH_USER_FIELD_LENGTH);
  if (!token || !expiresAt || !userId) return null;

  return { token, expiresAt, userId };
}

// ============================================================================
// API Functions
// ============================================================================

const getBaseUrl = () => getApiBaseUrl();

function getApiErrorMessage(
  error: ApiErrorPayload | undefined,
  fallback: string
): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (
    error &&
    typeof error === 'object' &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

async function parseApiResponse<T>(res: Response): Promise<ApiResponse<T>> {
  return res.json().catch(() => ({
    ok: false,
    error: { message: 'Invalid response' },
  }));
}

async function unwrapApiResponse<T>(
  res: Response,
  fallback: string
): Promise<T> {
  const json = await parseApiResponse<T>(res);

  if (!res.ok || !json.ok || !json.data) {
    throw new Error(getApiErrorMessage(json.error, fallback));
  }

  return json.data;
}

/**
 * Request a new TOTP challenge ID (5-min TTL)
 */
export async function initiateTotpChallenge(): Promise<TotpChallengeResponse> {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/totp/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return unwrapApiResponse<TotpChallengeResponse>(
    res,
    'Failed to get challenge'
  );
}

/**
 * Verify TOTP code against challenge → returns tokens
 */
export async function verifyTotpCode(
  challengeId: string,
  code: string
): Promise<TotpVerifyResponse> {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/totp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, code }),
  });
  return unwrapApiResponse<TotpVerifyResponse>(res, 'TOTP verification failed');
}

/**
 * Get TOTP setup status without requesting the secret itself.
 */
export async function getTotpSetupStatus(): Promise<TotpSetupStatusResponse> {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/totp/status`);
  return unwrapApiResponse<TotpSetupStatusResponse>(
    res,
    'Failed to load TOTP setup status'
  );
}

/**
 * Get TOTP setup info (QR code + secret)
 */
export async function getTotpSetup(
  setupToken?: string,
  accessToken?: string
): Promise<TotpSetupResponse> {
  const headers: Record<string, string> = {};
  const normalizedSetupToken = normalizeOptionalToken(setupToken);
  const normalizedAccessToken = normalizeOptionalToken(accessToken);
  if (setupToken?.trim() && !normalizedSetupToken) throw new Error('Invalid setup token');
  if (accessToken?.trim() && !normalizedAccessToken) throw new Error('Invalid bearer token');
  if (normalizedSetupToken) headers['Setup-Token'] = normalizedSetupToken;
  if (normalizedAccessToken) {
    headers.Authorization = bearerAuth(normalizedAccessToken).Authorization;
  }
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/totp/setup`, {
    headers,
  });
  return unwrapApiResponse<TotpSetupResponse>(res, 'Failed to get TOTP setup');
}

/**
 * Verify TOTP setup code to mark setup as complete
 */
export async function verifyTotpSetup(
  code: string,
  setupToken?: string
): Promise<TotpSetupVerifyResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const normalizedSetupToken = normalizeOptionalToken(setupToken);
  if (setupToken?.trim() && !normalizedSetupToken) throw new Error('Invalid setup token');
  if (normalizedSetupToken) headers['Setup-Token'] = normalizedSetupToken;
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/totp/setup/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code }),
  });
  return unwrapApiResponse<TotpSetupVerifyResponse>(
    res,
    'Setup verification failed'
  );
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshTokenResponse> {
  const normalizedRefreshToken = requireHeaderToken(refreshToken, 'Invalid refresh token');
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: normalizedRefreshToken }),
  });
  return unwrapApiResponse<RefreshTokenResponse>(res, 'Token refresh failed');
}

export async function consumeOAuthHandoff(handoff: string): Promise<OAuthHandoffResponse> {
  const normalizedHandoff = requireHeaderToken(handoff, 'Invalid OAuth handoff');
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/oauth/handoff/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handoff: normalizedHandoff }),
  });
  return unwrapApiResponse<OAuthHandoffResponse>(res, 'OAuth handoff failed');
}

/**
 * Logout (invalidate refresh token)
 */
export async function logout(refreshToken?: string): Promise<void> {
  try {
    const normalizedRefreshToken = normalizeOptionalToken(refreshToken);
    await fetch(`${getBaseUrl()}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: normalizedRefreshToken ?? undefined }),
    });
  } catch {
    // Ignore logout errors
  }
}

/**
 * Get current user info
 */
export async function getMe(accessToken: string): Promise<UserInfo> {
  const normalizedAccessToken = requireHeaderToken(accessToken);
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/me`, {
    headers: bearerAuth(normalizedAccessToken),
  });
  const data = await unwrapApiResponse<{ user: UserInfo }>(
    res,
    'Failed to get user info'
  );
  if (!isUserInfo(data.user)) {
    throw new Error('Failed to get user info');
  }
  return data.user;
}

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Parse JWT payload without verification (for expiration check)
 */
export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const normalizedToken = normalizeHeaderToken(token);
    if (!normalizedToken) return null;
    const parts = normalizedToken.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Check if token is expired or will expire within bufferSeconds
 */
export function isTokenExpired(token: string, bufferSeconds = 60): boolean {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;

  const expiresAt = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  const buffer = bufferSeconds * 1000;

  return now >= expiresAt - buffer;
}

/**
 * Get token expiration time in milliseconds
 */
export function getTokenExpiration(token: string): number | null {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp * 1000;
}

// ============================================================================
// Anonymous Token
// ============================================================================

const ANON_TOKEN_KEY = 'anon.token';

export interface AnonymousTokenResponse {
  token: string;
  expiresAt: string;
  userId: string;
}

/**
 * Request anonymous JWT token (30-day validity)
 */
export async function requestAnonymousToken(): Promise<AnonymousTokenResponse> {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/anonymous`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await unwrapApiResponse<AnonymousTokenResponse>(
    res,
    'Failed to get anonymous token'
  );
  const normalized = normalizeAnonymousTokenResponse(data);
  if (!normalized) throw new Error('Failed to get anonymous token');
  return normalized;
}

/**
 * Refresh anonymous token
 */
export async function refreshAnonymousToken(
  token: string
): Promise<AnonymousTokenResponse> {
  const normalizedToken = requireHeaderToken(token, 'Invalid anonymous token');
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/anonymous/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...bearerAuth(normalizedToken),
    },
  });
  const data = await unwrapApiResponse<AnonymousTokenResponse>(
    res,
    'Failed to refresh anonymous token'
  );
  const normalized = normalizeAnonymousTokenResponse(data);
  if (!normalized) throw new Error('Failed to refresh anonymous token');
  return normalized;
}

/**
 * Get stored anonymous token
 */
export function getStoredAnonymousToken(): string | null {
  try {
    const token = localStorage.getItem(ANON_TOKEN_KEY);
    const normalizedToken = normalizeHeaderToken(token);
    if (token && !normalizedToken) {
      clearAnonymousToken();
    }
    return normalizedToken;
  } catch {
    return null;
  }
}

/**
 * Store anonymous token
 */
export function storeAnonymousToken(token: string): void {
  try {
    const normalizedToken = requireHeaderToken(token, 'Invalid anonymous token');
    localStorage.setItem(ANON_TOKEN_KEY, normalizedToken);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear anonymous token
 */
export function clearAnonymousToken(): void {
  try {
    localStorage.removeItem(ANON_TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get a valid anonymous token, requesting/refreshing if needed
 */
export async function getValidAnonymousToken(): Promise<string> {
  const existing = getStoredAnonymousToken();

  // No token - request new one
  if (!existing) {
    const result = await requestAnonymousToken();
    storeAnonymousToken(result.token);
    return result.token;
  }

  // Check if token is still valid (with 1 day buffer)
  if (!isTokenExpired(existing, 86400)) {
    return existing;
  }

  // Try to refresh
  try {
    const result = await refreshAnonymousToken(existing);
    storeAnonymousToken(result.token);
    return result.token;
  } catch {
    // Refresh failed - request new token
    clearAnonymousToken();
    const result = await requestAnonymousToken();
    storeAnonymousToken(result.token);
    return result.token;
  }
}
