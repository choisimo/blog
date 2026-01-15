/**
 * Feature Flags Store
 *
 * Fetches feature flags from backend and provides reactive hooks.
 * Flags are cached and periodically refreshed.
 *
 * Usage:
 *   const { flags, isLoading } = useFeatureFlags();
 *   if (!flags.aiEnabled) return <DisabledMessage />;
 */

import { create } from 'zustand';
import { getApiBaseUrl } from '@/utils/apiBase';

// ============================================================================
// Types
// ============================================================================

export interface FeatureFlags {
  aiEnabled: boolean;
  ragEnabled: boolean;
  terminalEnabled: boolean;
  aiInline: boolean;
  commentsEnabled: boolean;
}

export interface RuntimeConfig {
  siteBaseUrl?: string;
  apiBaseUrl?: string;
  env?: string;
  features: FeatureFlags;
}

export interface FeatureFlagsState {
  // State
  flags: FeatureFlags;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchFlags: () => Promise<void>;
  setFlags: (flags: Partial<FeatureFlags>) => void;
  resetToDefaults: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FLAGS: FeatureFlags = {
  aiEnabled: true,
  ragEnabled: true,
  terminalEnabled: true,
  aiInline: true,
  commentsEnabled: true,
};

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

// ============================================================================
// Store
// ============================================================================

export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => ({
  // Initial state - optimistically enable all features
  flags: { ...DEFAULT_FLAGS },
  isLoading: false,
  error: null,
  lastFetched: null,

  /**
   * Fetch feature flags from backend API
   * Uses cache to avoid unnecessary requests
   */
  fetchFlags: async () => {
    const { lastFetched, isLoading } = get();

    // Skip if already loading
    if (isLoading) return;

    // Use cache if fresh
    if (lastFetched && Date.now() - lastFetched < CACHE_DURATION_MS) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const apiBase = getApiBaseUrl().replace(/\/$/, '');
      const response = await fetch(`${apiBase}/api/v1/public/config`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        // Don't fail on non-2xx - we'll use defaults
        credentials: 'omit',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();

      // Handle both { data: { features } } and { features } structures
      const data = json?.data ?? json;
      const features = data?.features;

      if (features && typeof features === 'object') {
        set({
          flags: {
            aiEnabled: features.aiEnabled ?? DEFAULT_FLAGS.aiEnabled,
            ragEnabled: features.ragEnabled ?? DEFAULT_FLAGS.ragEnabled,
            terminalEnabled: features.terminalEnabled ?? DEFAULT_FLAGS.terminalEnabled,
            aiInline: features.aiInline ?? DEFAULT_FLAGS.aiInline,
            commentsEnabled: features.commentsEnabled ?? DEFAULT_FLAGS.commentsEnabled,
          },
          isLoading: false,
          lastFetched: Date.now(),
        });

        // Also inject into window for legacy compatibility
        if (typeof window !== 'undefined') {
          const w = window as any;
          w.APP_CONFIG = w.APP_CONFIG || {};
          w.APP_CONFIG.features = get().flags;
        }
      } else {
        // No features in response - use defaults
        set({
          isLoading: false,
          lastFetched: Date.now(),
        });
      }
    } catch (err) {
      console.warn('[FeatureFlags] Failed to fetch, using defaults:', err);
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        // Keep current flags (defaults) on error
      });
    }
  },

  /**
   * Manually override flags (for testing/admin)
   */
  setFlags: (partial) => {
    set((state) => ({
      flags: { ...state.flags, ...partial },
    }));
  },

  /**
   * Reset to default values
   */
  resetToDefaults: () => {
    set({
      flags: { ...DEFAULT_FLAGS },
      lastFetched: null,
      error: null,
    });
  },
}));

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to use feature flags with auto-fetch
 *
 * @example
 * const { flags, isLoading } = useFeatureFlags();
 * if (!flags.aiEnabled) return null;
 */
export function useFeatureFlags() {
  const { flags, isLoading, error, fetchFlags } = useFeatureFlagsStore();

  // Auto-fetch on mount (will use cache if fresh)
  if (typeof window !== 'undefined') {
    // Use queueMicrotask to avoid React render loop
    queueMicrotask(() => {
      fetchFlags();
    });
  }

  return { flags, isLoading, error };
}

/**
 * Check if a specific feature is enabled
 *
 * @example
 * const isAiEnabled = useFeatureEnabled('aiEnabled');
 */
export function useFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const { flags } = useFeatureFlags();
  return flags[feature] ?? false;
}

/**
 * Get flags synchronously (for non-React contexts)
 * Note: May return defaults if not yet fetched
 */
export function getFeatureFlags(): FeatureFlags {
  return useFeatureFlagsStore.getState().flags;
}

/**
 * Force refresh flags (bypasses cache)
 */
export async function refreshFeatureFlags(): Promise<void> {
  const store = useFeatureFlagsStore.getState();
  // Reset lastFetched to bypass cache
  useFeatureFlagsStore.setState({ lastFetched: null });
  await store.fetchFlags();
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize feature flags on app startup
 * Call this in App.tsx or index.tsx
 */
export function initFeatureFlags(): void {
  if (typeof window === 'undefined') return;

  // Fetch immediately on startup
  useFeatureFlagsStore.getState().fetchFlags();

  // Refresh when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      useFeatureFlagsStore.getState().fetchFlags();
    }
  });
}
