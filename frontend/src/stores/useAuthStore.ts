/**
 * Admin Authentication Store
 *
 * Manages access/refresh tokens with:
 * - Persistent storage
 * - Auto token refresh
 * - Token expiration tracking
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  refreshAccessToken,
  isTokenExpired,
  getTokenExpiration,
  logout as logoutApi,
  type UserInfo,
} from '@/services/auth';

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
  setTokens: (accessToken: string, refreshToken: string, user?: UserInfo) => void;
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

// Refresh lock to prevent concurrent refreshes
let refreshPromise: Promise<string | null> | null = null;

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
       */
      setTokens: (accessToken, refreshToken, user) => {
        set({ accessToken, refreshToken, user: user ?? get().user });
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
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isRefreshing: false,
        });
      },

      /**
       * Full logout: API call + clear state
       */
      logout: async () => {
        const { refreshToken } = get();
        try {
          await logoutApi(refreshToken ?? undefined);
        } finally {
          get().clearAuth();
        }
      },

      /**
       * Get a valid access token, refreshing if necessary
       * Returns null if unable to get a valid token (user should re-authenticate)
       */
      getValidAccessToken: async () => {
        const { accessToken, refreshToken } = get();

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
            set({
              accessToken: result.accessToken,
              isRefreshing: false,
            });
            return result.accessToken;
          } catch (error) {
            console.error('Token refresh failed:', error);
            get().clearAuth();
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
        const { accessToken, refreshToken } = get();

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
  return accessToken
    ? {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
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
        Authorization: `Bearer ${token}`,
      }
    : { 'Content-Type': 'application/json' };
}

/**
 * Schedule token refresh before expiration
 * Call this after login to set up auto-refresh
 */
export function scheduleTokenRefresh(): () => void {
  const { accessToken } = useAuthStore.getState();

  if (!accessToken) return () => {};

  const expiration = getTokenExpiration(accessToken);
  if (!expiration) return () => {};

  // Refresh 1 minute before expiration
  const refreshAt = expiration - 60 * 1000;
  const delay = Math.max(0, refreshAt - Date.now());

  const timeoutId = setTimeout(async () => {
    await useAuthStore.getState().getValidAccessToken();
    // Schedule next refresh
    scheduleTokenRefresh();
  }, delay);

  return () => clearTimeout(timeoutId);
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
