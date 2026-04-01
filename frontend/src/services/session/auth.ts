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
  tokenType: string;
  expiresIn: number;
}

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

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiErrorPayload;
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
  if (setupToken) headers['Setup-Token'] = setupToken;
  if (accessToken) headers.Authorization = bearerAuth(accessToken).Authorization;
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
  if (setupToken) headers['Setup-Token'] = setupToken;
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
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  return unwrapApiResponse<RefreshTokenResponse>(res, 'Token refresh failed');
}

/**
 * Logout (invalidate refresh token)
 */
export async function logout(refreshToken?: string): Promise<void> {
  try {
    await fetch(`${getBaseUrl()}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Ignore logout errors
  }
}

/**
 * Get current user info
 */
export async function getMe(accessToken: string): Promise<UserInfo> {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/me`, {
    headers: bearerAuth(accessToken),
  });
  const data = await unwrapApiResponse<{ user: UserInfo }>(
    res,
    'Failed to get user info'
  );
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
    const parts = token.split('.');
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
  return unwrapApiResponse<AnonymousTokenResponse>(
    res,
    'Failed to get anonymous token'
  );
}

/**
 * Refresh anonymous token
 */
export async function refreshAnonymousToken(
  token: string
): Promise<AnonymousTokenResponse> {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/anonymous/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...bearerAuth(token),
    },
  });
  return unwrapApiResponse<AnonymousTokenResponse>(
    res,
    'Failed to refresh anonymous token'
  );
}

/**
 * Get stored anonymous token
 */
export function getStoredAnonymousToken(): string | null {
  try {
    return localStorage.getItem(ANON_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Store anonymous token
 */
export function storeAnonymousToken(token: string): void {
  try {
    localStorage.setItem(ANON_TOKEN_KEY, token);
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
