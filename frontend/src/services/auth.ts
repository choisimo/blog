/**
 * Admin Authentication Service
 *
 * 2-Step OTP Authentication Flow:
 * 1. login(username, password) → sessionId
 * 2. verifyOtp(sessionId, otp) → { accessToken, refreshToken }
 *
 * Features:
 * - Access token (15min) / Refresh token (7 days)
 * - Auto token refresh before expiration
 * - Secure token storage with Zustand persist
 */

import { getApiBaseUrl } from '@/utils/apiBase';

// ============================================================================
// Types
// ============================================================================

export interface LoginResponse {
  sessionId: string;
  message: string;
  expiresAt: string;
  _dev_otp?: string; // Only in development mode
}

export interface VerifyOtpResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    username: string;
    email: string;
    role: string;
  };
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

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// API Functions
// ============================================================================

const getBaseUrl = () => getApiBaseUrl();

/**
 * Step 1: Login with credentials → Sends OTP to admin email
 */
export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const json: ApiResponse<LoginResponse> = await res.json().catch(() => ({
    ok: false,
    error: 'Invalid response',
  }));

  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || 'Login failed');
  }

  return json.data;
}

/**
 * Step 2: Verify OTP → Returns access + refresh tokens
 */
export async function verifyOtp(
  sessionId: string,
  otp: string
): Promise<VerifyOtpResponse> {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, otp }),
  });

  const json: ApiResponse<VerifyOtpResponse> = await res.json().catch(() => ({
    ok: false,
    error: 'Invalid response',
  }));

  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || 'OTP verification failed');
  }

  return json.data;
}

/**
 * Resend OTP for existing session
 */
export async function resendOtp(
  sessionId: string
): Promise<{ message: string; expiresAt: string; _dev_otp?: string }> {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  const json = await res.json().catch(() => ({
    ok: false,
    error: 'Invalid response',
  }));

  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || 'Failed to resend OTP');
  }

  return json.data;
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

  const json: ApiResponse<RefreshTokenResponse> = await res
    .json()
    .catch(() => ({
      ok: false,
      error: 'Invalid response',
    }));

  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || 'Token refresh failed');
  }

  return json.data;
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
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json: ApiResponse<{ user: UserInfo }> = await res
    .json()
    .catch(() => ({
      ok: false,
      error: 'Invalid response',
    }));

  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || 'Failed to get user info');
  }

  return json.data.user;
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

  const json: ApiResponse<AnonymousTokenResponse> = await res.json().catch(() => ({
    ok: false,
    error: 'Invalid response',
  }));

  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || 'Failed to get anonymous token');
  }

  return json.data;
}

/**
 * Refresh anonymous token
 */
export async function refreshAnonymousToken(token: string): Promise<AnonymousTokenResponse> {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/anonymous/refresh`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const json: ApiResponse<AnonymousTokenResponse> = await res.json().catch(() => ({
    ok: false,
    error: 'Invalid response',
  }));

  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || 'Failed to refresh anonymous token');
  }

  return json.data;
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
