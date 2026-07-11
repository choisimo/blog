/**
 * Admin Authentication Store
 *
 * Manages access/refresh tokens with:
 * - Persistent storage
 * - Auto token refresh
 * - Token expiration tracking
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { bearerAuth } from '@/lib/auth';
import {
  refreshAccessToken,
  isTokenExpired,
  getTokenExpiration,
  logout as logoutApi,
  type UserInfo,
} from '@/services/session/auth';

// ============================================================================
// Types
// ============================================================================

export interface AuthState {
  // Token state
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;

  // Loading state
  isRefreshing: boolean;

  // Actions
  setTokens: (accessToken: string, refreshToken: string, user?: UserInfo) => boolean;
  setTokensFromOAuth: (accessToken: string, refreshToken: string) => boolean;
  setUser: (user: UserInfo | null) => void;
  clearAuth: () => void;
  logout: () => Promise<void>;

  // Token management
  getValidAccessToken: () => Promise<string | null>;
  isAuthenticated: () => boolean;
}

// ============================================================================
// Store
// ============================================================================

const STORAGE_KEY = 'admin.auth';
const MAX_AUTH_STORE_TOKEN_LENGTH = 4096;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

// Refresh lock to prevent concurrent refreshes
let refreshPromise: Promise<string | null> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearTokenRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

export function normalizeAuthStoreToken(token: string | null | undefined): string | null {
  if (typeof token !== 'string') return null;
  const value = token.trim();
  if (
    !value ||
    value.length > MAX_AUTH_STORE_TOKEN_LENGTH ||
    /\s/.test(value) ||
    CONTROL_CHAR_PATTERN.test(value) ||
    /%(?:0a|0d)/i.test(value)
  ) {
    return null;
  }
  return value;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      accessToken: null,
      refreshToken: null,
      user: null,
      isRefreshing: false,

      /**
       * Set both tokens after successful OTP verification
       * Returns whether both tokens were accepted by store normalization
       */
      setTokens: (accessToken, refreshToken, user) => {
        const normalizedAccessToken = normalizeAuthStoreToken(accessToken);
        const normalizedRefreshToken = normalizeAuthStoreToken(refreshToken);

        if (!normalizedAccessToken || !normalizedRefreshToken) {
          get().clearAuth();
          return false;
        }

        set({
          accessToken: normalizedAccessToken,
          refreshToken: normalizedRefreshToken,
          user: user ?? get().user,
        });
        scheduleTokenRefresh();
        return true;
      },
      /**
       * Set both tokens after successful OAuth callback
       * Returns whether both tokens were accepted by store normalization
       */
      setTokensFromOAuth: (accessToken, refreshToken) => {
        const normalizedAccessToken = normalizeAuthStoreToken(accessToken);
        const normalizedRefreshToken = normalizeAuthStoreToken(refreshToken);

        if (!normalizedAccessToken || !normalizedRefreshToken) {
          get().clearAuth();
          return false;
        }

        set({
          accessToken: normalizedAccessToken,
          refreshToken: normalizedRefreshToken,
        });
        scheduleTokenRefresh();
        return true;
      },

      /**
       * Update user info
       */
      setUser: (user) => {
        set({ user });
      },

      /**
       * Clear all auth state (local only, no API call)
       */
      clearAuth: () => {
        clearTokenRefreshTimer();
        refreshPromise = null;
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isRefreshing: false,
        });
      },

      /**
       * Full logout: clear local state + API call
       */
      logout: async () => {
        const { refreshToken } = get();
        get().clearAuth();
        await logoutApi(refreshToken ?? undefined);
      },

      /**
       * Get a valid access token, refreshing if necessary
       * Returns null if unable to get a valid token (user should re-authenticate)
       */
      getValidAccessToken: async () => {
        const storedAccessToken = get().accessToken;
        const storedRefreshToken = get().refreshToken;
        const accessToken = normalizeAuthStoreToken(storedAccessToken);
        const refreshToken = normalizeAuthStoreToken(storedRefreshToken);

        if (
          (storedAccessToken && !accessToken) ||
          (storedRefreshToken && !refreshToken)
        ) {
          get().clearAuth();
          return null;
        }

        // No tokens at all
        if (!accessToken && !refreshToken) {
          return null;
        }

        // Access token exists and is still valid
        if (accessToken && !isTokenExpired(accessToken, 60)) {
          return accessToken;
        }

        // No refresh token available
        if (!refreshToken) {
          get().clearAuth();
          return null;
        }

        // Check if refresh token itself is expired
        if (isTokenExpired(refreshToken, 0)) {
          get().clearAuth();
          return null;
        }

        // Use existing refresh promise if one is in progress
        if (refreshPromise) {
          return refreshPromise;
        }

        // Start refresh
        set({ isRefreshing: true });

        refreshPromise = (async () => {
          try {
            const result = await refreshAccessToken(refreshToken);
            if (get().refreshToken !== refreshToken) {
              set({ isRefreshing: false });
              return null;
            }

            const normalizedAccessToken = normalizeAuthStoreToken(result.accessToken);
            const normalizedRefreshToken = normalizeAuthStoreToken(result.refreshToken);

            if (!normalizedAccessToken || !normalizedRefreshToken) {
              get().clearAuth();
              return null;
            }

            set({
              accessToken: normalizedAccessToken,
              refreshToken: normalizedRefreshToken,
              isRefreshing: false,
            });
            scheduleTokenRefresh();
            return normalizedAccessToken;
          } catch (error) {
            console.error('Token refresh failed:', error);
            if (get().refreshToken === refreshToken) {
              get().clearAuth();
            } else {
              set({ isRefreshing: false });
            }
            return null;
          } finally {
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },

      /**
       * Check if user is authenticated (has valid tokens)
       */
      isAuthenticated: () => {
        const accessToken = normalizeAuthStoreToken(get().accessToken);
        const refreshToken = normalizeAuthStoreToken(get().refreshToken);

        // Has valid access token
        if (accessToken && !isTokenExpired(accessToken, 0)) {
          return true;
        }

        // Has valid refresh token (can get new access token)
        if (refreshToken && !isTokenExpired(refreshToken, 0)) {
          return true;
        }

        return false;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);

// ============================================================================
// Helper Hooks & Functions
// ============================================================================

/**
 * Get auth headers for API calls
 * This is a simple sync function - use getValidAccessToken for auto-refresh
 */
export function getAuthHeaders(): Record<string, string> {
  const { accessToken } = useAuthStore.getState();
  const token = normalizeAuthStoreToken(accessToken);

  if (accessToken && !token) {
    useAuthStore.getState().clearAuth();
  }

  return accessToken
    ? {
        'Content-Type': 'application/json',
        ...(token ? bearerAuth(token) : {}),
      }
    : { 'Content-Type': 'application/json' };
}

/**
 * Get auth headers with auto-refresh (async)
 */
export async function getAuthHeadersAsync(): Promise<Record<string, string>> {
  const token = await useAuthStore.getState().getValidAccessToken();
  return token
    ? {
        'Content-Type': 'application/json',
        ...bearerAuth(token),
      }
    : { 'Content-Type': 'application/json' };
}

/**
 * Schedule token refresh before expiration
 * Call this after login to set up auto-refresh
 */
export function scheduleTokenRefresh(): () => void {
  clearTokenRefreshTimer();

  const { accessToken } = useAuthStore.getState();
  const normalizedAccessToken = normalizeAuthStoreToken(accessToken);

  if (!normalizedAccessToken) return () => {};

  const expiration = getTokenExpiration(normalizedAccessToken);
  if (!expiration) return () => {};

  // Refresh 1 minute before expiration
  const refreshAt = expiration - 60 * 1000;
  const delay = Math.max(0, refreshAt - Date.now());

  refreshTimer = setTimeout(async () => {
    await useAuthStore.getState().getValidAccessToken();
    // Schedule next refresh
    scheduleTokenRefresh();
  }, delay);

  return () => {
    clearTokenRefreshTimer();
  };
}

export function cancelTokenRefresh(): void {
  clearTokenRefreshTimer();
}

// ============================================================================
// Legacy Support
// ============================================================================

/**
 * Migrate from old adminToken storage to new auth store
 */
export function migrateFromLegacyStorage(): void {
  try {
    // Check for old adminToken
    const legacyToken = localStorage.getItem('adminToken');
    if (legacyToken) {
      // Remove legacy token - user will need to re-authenticate with new OTP flow
      localStorage.removeItem('adminToken');
      console.log('Legacy adminToken removed. Please log in again with the new OTP flow.');
    }

    // Check for old aiMemo.auth storage
    const oldAuthKeys = ['aiMemo.auth', 'aiMemo.authToken', 'aiMemo.jwt', 'auth.token'];
    for (const key of oldAuthKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage errors
  }
}
