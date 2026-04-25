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
import type { PublicRuntimeConfig } from "@blog/shared/contracts/public-runtime-config";
import { getApiBaseUrl } from "@/utils/network/apiBase";

// ============================================================================
// Types
// ============================================================================

export type FeatureFlags = PublicRuntimeConfig["features"];
export type RuntimeConfig = PublicRuntimeConfig;

type RuntimeAppConfig = Partial<RuntimeConfig> & {
  capabilities?: Partial<RuntimeConfig["capabilities"]>;
  ai?: Partial<RuntimeConfig["ai"]>;
  features?: Partial<FeatureFlags>;
};

type RuntimeWindow = Window & {
  APP_CONFIG?: RuntimeAppConfig;
};

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

function mergeFeatureFlags(features?: Partial<FeatureFlags> | null): FeatureFlags {
  return {
    aiEnabled: features?.aiEnabled ?? DEFAULT_FLAGS.aiEnabled,
    ragEnabled: features?.ragEnabled ?? DEFAULT_FLAGS.ragEnabled,
    terminalEnabled:
      features?.terminalEnabled ?? DEFAULT_FLAGS.terminalEnabled,
    aiInline: features?.aiInline ?? DEFAULT_FLAGS.aiInline,
    commentsEnabled:
      features?.commentsEnabled ?? DEFAULT_FLAGS.commentsEnabled,
  };
}

function getInitialFeatureFlags(): FeatureFlags {
  if (typeof window === "undefined") {
    return { ...DEFAULT_FLAGS };
  }

  const runtimeFeatures = (window as RuntimeWindow).APP_CONFIG?.features;
  if (runtimeFeatures && typeof runtimeFeatures === "object") {
    return mergeFeatureFlags(runtimeFeatures);
  }

  return { ...DEFAULT_FLAGS };
}

function applyRuntimeConfigToWindow(runtimeConfig: RuntimeAppConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  const w = window as RuntimeWindow;
  w.APP_CONFIG = w.APP_CONFIG ?? {};

  if (runtimeConfig.siteBaseUrl !== undefined) {
    w.APP_CONFIG.siteBaseUrl = runtimeConfig.siteBaseUrl;
  }
  if (typeof runtimeConfig.apiBaseUrl === "string" && runtimeConfig.apiBaseUrl) {
    w.APP_CONFIG.apiBaseUrl = runtimeConfig.apiBaseUrl;
  }
  if (typeof runtimeConfig.chatBaseUrl === "string" && runtimeConfig.chatBaseUrl) {
    w.APP_CONFIG.chatBaseUrl = runtimeConfig.chatBaseUrl;
  }
  if (typeof runtimeConfig.chatWsBaseUrl === "string" && runtimeConfig.chatWsBaseUrl) {
    w.APP_CONFIG.chatWsBaseUrl = runtimeConfig.chatWsBaseUrl;
  } else if (runtimeConfig.chatWsBaseUrl === null) {
    w.APP_CONFIG.chatWsBaseUrl = undefined;
  }
  if (runtimeConfig.terminalGatewayUrl !== undefined) {
    w.APP_CONFIG.terminalGatewayUrl = runtimeConfig.terminalGatewayUrl ?? null;
  }
  if (typeof runtimeConfig.env === "string" && runtimeConfig.env) {
    w.APP_CONFIG.env = runtimeConfig.env;
  }
  if (runtimeConfig.capabilities && typeof runtimeConfig.capabilities === "object") {
    w.APP_CONFIG.capabilities = {
      ...(w.APP_CONFIG.capabilities ?? {}),
      ...runtimeConfig.capabilities,
    };
  }
  if (runtimeConfig.ai && typeof runtimeConfig.ai === "object") {
    w.APP_CONFIG.ai = {
      ...(w.APP_CONFIG.ai ?? {}),
      ...runtimeConfig.ai,
    };
  }
  if (runtimeConfig.features && typeof runtimeConfig.features === "object") {
    w.APP_CONFIG.features = {
      ...(w.APP_CONFIG.features ?? DEFAULT_FLAGS),
      ...runtimeConfig.features,
    } as FeatureFlags;
  }
}

// ============================================================================
// Store
// ============================================================================

export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => ({
  // Initial state - keep optional infrastructure-backed features safe by default
  flags: getInitialFeatureFlags(),
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
      const data = (json?.data ?? json) as RuntimeAppConfig | null;
      const features = data?.features;

      if (features && typeof features === "object") {
        const nextFlags = mergeFeatureFlags(features);

        set({
          flags: nextFlags,
          isLoading: false,
          lastFetched: Date.now(),
        });

        applyRuntimeConfigToWindow({ ...(data ?? {}), features: nextFlags });
      } else {
        // No features in response - use defaults
        set({
          isLoading: false,
          lastFetched: Date.now(),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const isRuntimeConfigError =
        err instanceof Error && err.message.startsWith("[apiBase]");
      const log = isRuntimeConfigError ? console.error : console.warn;
      log("[FeatureFlags] Failed to fetch public runtime config:", err);
      set({
        isLoading: false,
        error: message,
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
