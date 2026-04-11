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

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { getApiBaseUrl } from "@/utils/network/apiBase";

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
  chatBaseUrl?: string;
  chatWsBaseUrl?: string;
  terminalGatewayUrl?: string | null;
  env?: string;
  capabilities?: {
    supportsChatWebSocket?: boolean;
    hasTerminalGatewayUrl?: boolean;
  };
  ai?: {
    modelSelectionEnabled?: boolean;
    defaultModel?: string | null;
    visionModel?: string | null;
  };
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
  aiEnabled: false,
  ragEnabled: false,
  terminalEnabled: false,
  aiInline: false,
  commentsEnabled: false,
};

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;
let featureFlagsInitialized = false;
let visibilityChangeHandler: (() => void) | null = null;

// ============================================================================
// Store
// ============================================================================

export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => ({
  // Initial state - keep optional infrastructure-backed features safe by default
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
      const apiBase = getApiBaseUrl().replace(/\/$/, "");
      const response = await fetch(`${apiBase}/api/v1/public/config`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        // Don't fail on non-2xx - we'll use defaults
        credentials: "omit",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();

      // Handle both { data: { features } } and { features } structures
      const data = json?.data ?? json;
      const features = data?.features;

      if (features && typeof features === "object") {
        set({
          flags: {
            aiEnabled: features.aiEnabled ?? DEFAULT_FLAGS.aiEnabled,
            ragEnabled: features.ragEnabled ?? DEFAULT_FLAGS.ragEnabled,
            terminalEnabled:
              features.terminalEnabled ?? DEFAULT_FLAGS.terminalEnabled,
            aiInline: features.aiInline ?? DEFAULT_FLAGS.aiInline,
            commentsEnabled:
              features.commentsEnabled ?? DEFAULT_FLAGS.commentsEnabled,
          },
          isLoading: false,
          lastFetched: Date.now(),
        });

        // Also inject into window for legacy compatibility
        if (typeof window !== "undefined") {
          const w = window as Window & {
            APP_CONFIG?: {
              apiBaseUrl?: string;
              chatBaseUrl?: string;
              chatWsBaseUrl?: string;
              terminalGatewayUrl?: string | null;
              capabilities?: RuntimeConfig["capabilities"];
              ai?: Record<string, unknown>;
              features?: FeatureFlags;
            };
          };
          w.APP_CONFIG = w.APP_CONFIG ?? {};
          if (typeof data?.apiBaseUrl === "string" && data.apiBaseUrl) {
            w.APP_CONFIG.apiBaseUrl = data.apiBaseUrl;
          }
          if (typeof data?.chatBaseUrl === "string" && data.chatBaseUrl) {
            w.APP_CONFIG.chatBaseUrl = data.chatBaseUrl;
          }
          if (typeof data?.chatWsBaseUrl === "string" && data.chatWsBaseUrl) {
            w.APP_CONFIG.chatWsBaseUrl = data.chatWsBaseUrl;
          }
          if (data?.chatWsBaseUrl === null) {
            w.APP_CONFIG.chatWsBaseUrl = undefined;
          }
          if (
            data?.terminalGatewayUrl === null ||
            (typeof data?.terminalGatewayUrl === "string" && data.terminalGatewayUrl)
          ) {
            w.APP_CONFIG.terminalGatewayUrl = data.terminalGatewayUrl ?? null;
          }
          if (data?.capabilities && typeof data.capabilities === "object") {
            w.APP_CONFIG.capabilities = {
              ...(w.APP_CONFIG.capabilities ?? {}),
              ...(data.capabilities as RuntimeConfig["capabilities"]),
            };
          }
          if (data?.ai && typeof data.ai === "object") {
            w.APP_CONFIG.ai = {
              ...(w.APP_CONFIG.ai ?? {}),
              ...(data.ai as Record<string, unknown>),
            };
          }
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
      console.warn("[FeatureFlags] Failed to fetch, using defaults:", err);
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Unknown error",
        lastFetched: Date.now(),
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
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchFlags();
    }
  }, [fetchFlags]);

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
  if (typeof window === "undefined" || featureFlagsInitialized) return;
  featureFlagsInitialized = true;

  // Fetch immediately on startup
  useFeatureFlagsStore.getState().fetchFlags();

  // Refresh when tab becomes visible
  visibilityChangeHandler = () => {
    if (document.visibilityState === "visible") {
      useFeatureFlagsStore.getState().fetchFlags();
    }
  };
  document.addEventListener("visibilitychange", visibilityChangeHandler);
}

export function disposeFeatureFlags(): void {
  if (visibilityChangeHandler) {
    document.removeEventListener("visibilitychange", visibilityChangeHandler);
    visibilityChangeHandler = null;
  }
  featureFlagsInitialized = false;
}
