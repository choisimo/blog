/**
 * Dynamic AI Configuration Service
 *
 * Fetches AI config (baseUrl, apiKey, defaultModel) from Worker D1/KV
 * at request time with a TTL-based in-memory cache (stale-while-revalidate).
 *
 * Priority on config source:
 *   1. Worker /api/v1/internal/ai-config (D1 secret → KV → env in Worker)
 *   2. Local env/config fallback (if Worker unreachable)
 *
 * Usage:
 *   import { getCachedAIConfigSnapshot, getDynamicAIConfig } from './dynamic-config.service.js';
 *
 *   // Synchronous (returns stale snapshot immediately, may start background refresh)
 *   const snapshot = getCachedAIConfigSnapshot();
 *
 *   // Async (waits for fresh data if cache is empty, otherwise uses cached)
 *   const snapshot = await getDynamicAIConfig();
 */

import { config } from '../../config.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('dynamic-config');

// =============================================================================
// Constants
// =============================================================================

const CACHE_TTL_MS = 60_000; // 60 seconds
const FETCH_TIMEOUT_MS = 5_000; // 5 seconds for Worker fetch

// =============================================================================
// Module State
// =============================================================================

/** @type {AIConfigSnapshot | null} */
let currentSnapshot = null;

/** @type {Promise<AIConfigSnapshot> | null} */
let refreshPromise = null;

/** @type {ProviderSnapshot | null} */
let currentProviderSnapshot = null;

/** @type {Promise<ProviderSnapshot> | null} */
let providerRefreshPromise = null;

/** @type {{status: 'unknown' | 'ok' | 'degraded', source: 'worker' | 'env' | 'none', reason: string | null, updatedAt: string | null}} */
let aiConfigHealth = {
  status: 'unknown',
  source: 'none',
  reason: null,
  updatedAt: null,
};

// =============================================================================
// Types (JSDoc)
// =============================================================================

/**
 * @typedef {Object} AIConfigSnapshot
 * @property {'worker' | 'env'} source - Where the config came from
 * @property {string} baseUrl - AI server base URL
 * @property {string | null} apiKey - AI API key
 * @property {string | null} defaultModel - Default model name
 * @property {string} fingerprint - Hash of baseUrl+apiKey+defaultModel for change detection
 * @property {number} fetchedAt - When this snapshot was created (Date.now())
 * @property {number} expiresAt - When this snapshot expires (fetchedAt + CACHE_TTL_MS)
 */

/**
 * @typedef {Object} ProviderSnapshotProvider
 * @property {string} id
 * @property {string} name
 * @property {string} displayName
 * @property {string | null} apiBaseUrl
 * @property {string | null} apiKeyEnv
 * @property {boolean} isEnabled
 * @property {string} healthStatus
 * @property {string | null} resolvedApiKey - API key resolved by Worker (from D1 secrets / env)
 */

/**
 * @typedef {Object} ProviderSnapshotModel
 * @property {string} id
 * @property {string} provider_id
 * @property {string} model_name
 * @property {string} display_name
 * @property {string} model_identifier
 * @property {number | null} context_window
 * @property {number | null} max_tokens
 * @property {number} supports_vision
 * @property {number} supports_streaming
 * @property {number} supports_function_calling
 * @property {number} is_enabled
 * @property {number} priority
 */

/**
 * @typedef {Object} ProviderSnapshotRoute
 * @property {string} id
 * @property {string} name
 * @property {string} routing_strategy
 * @property {string | null} primary_model_id
 * @property {string | null} fallback_model_ids - JSON array string
 * @property {string | null} context_window_fallback_ids - JSON array string
 * @property {number} num_retries
 * @property {number} timeout_seconds
 * @property {number} is_default
 * @property {number} is_enabled
 */

/**
 * @typedef {Object} ProviderSnapshot
 * @property {'worker'} source
 * @property {ProviderSnapshotProvider[]} providers
 * @property {ProviderSnapshotModel[]} models
 * @property {ProviderSnapshotRoute | null} defaultRoute
 * @property {number} fetchedAt
 * @property {number} expiresAt
 */

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Build a fingerprint string for change detection.
 * @param {string} baseUrl
 * @param {string | null} apiKey
 * @param {string | null} defaultModel
 * @returns {string}
 */
function buildFingerprint(baseUrl, apiKey, defaultModel) {
  return `${baseUrl}::${apiKey ?? ''}::${defaultModel ?? ''}`;
}

function markAiConfigHealth(next) {
  aiConfigHealth = {
    ...aiConfigHealth,
    ...next,
    updatedAt: new Date().toISOString(),
  };
}

export function getAiConfigHealth() {
  return { ...aiConfigHealth };
}

/**
 * Get the fallback snapshot from local env/config (synchronous).
 * @returns {AIConfigSnapshot}
 */
function getEnvFallbackSnapshot() {
  const baseUrl = config.ai?.baseUrl || process.env.AI_SERVER_URL || 'https://api.openai.com/v1';
  const apiKey = config.ai?.apiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || null;
  const defaultModel = config.ai?.defaultModel || process.env.AI_DEFAULT_MODEL || null;
  const now = Date.now();

  return {
    source: 'env',
    baseUrl,
    apiKey,
    defaultModel,
    fingerprint: buildFingerprint(baseUrl, apiKey, defaultModel),
    fetchedAt: now,
    expiresAt: now + CACHE_TTL_MS,
  };
}

/**
 * Check if a snapshot has expired.
 * @param {AIConfigSnapshot | null} snapshot
 * @returns {boolean}
 */
function hasSnapshotExpired(snapshot) {
  if (!snapshot) return true;
  return Date.now() >= snapshot.expiresAt;
}

/**
 * Fetch AI config from Worker internal endpoint.
 * @returns {Promise<AIConfigSnapshot>}
 */
async function fetchWorkerAIConfig() {
  const workerApiUrl = config.services?.workerApiUrl;
  if (!workerApiUrl) {
    throw new Error('WORKER_API_URL not configured');
  }

  const backendKey = config.backendKey;
  if (!backendKey) {
    throw new Error('BACKEND_KEY not configured — cannot authenticate with Worker');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${workerApiUrl}/api/v1/internal/ai-config`, {
      method: 'GET',
      headers: {
        'X-Backend-Key': backendKey,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Worker returned HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!json.ok || !json.data) {
      throw new Error('Worker returned unexpected response shape');
    }

    const { baseUrl, apiKey, defaultModel } = json.data;
    const now = Date.now();

    return {
      source: 'worker',
      baseUrl: baseUrl || getEnvFallbackSnapshot().baseUrl,
      apiKey: apiKey || null,
      defaultModel: defaultModel || null,
      fingerprint: buildFingerprint(baseUrl, apiKey, defaultModel),
      fetchedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Perform a background refresh of the AI config cache.
 * Collapses concurrent calls into a single in-flight promise.
 * Never throws — errors are logged and fallback is used.
 * @returns {Promise<AIConfigSnapshot>}
 */
async function refreshAIConfig() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const snapshot = await fetchWorkerAIConfig();
      const prev = currentSnapshot;
      currentSnapshot = snapshot;

      if (!prev || prev.fingerprint !== snapshot.fingerprint) {
        logger.info(
          { operation: 'refresh', source: snapshot.source },
          'AI config updated from Worker',
          { model: snapshot.defaultModel, baseUrl: snapshot.baseUrl }
        );
      }

      markAiConfigHealth({
        status: 'ok',
        source: snapshot.source,
        reason: null,
      });

      return snapshot;
    } catch (err) {
      logger.warn(
        { operation: 'refresh' },
        'Failed to fetch AI config from Worker, using env fallback',
        { error: err.message }
      );

      // Extend current snapshot TTL rather than returning expired data
      if (currentSnapshot) {
        currentSnapshot = {
          ...currentSnapshot,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        markAiConfigHealth({
          status: 'degraded',
          source: currentSnapshot.source,
          reason: err.message,
        });
        return currentSnapshot;
      }

      const fallback = getEnvFallbackSnapshot();
      currentSnapshot = fallback;
      markAiConfigHealth({
        status: 'degraded',
        source: fallback.source,
        reason: err.message,
      });
      return fallback;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the current cached AI config snapshot synchronously.
 *
 * If no snapshot exists, initializes from env fallback immediately.
 * If snapshot is expired, starts a background refresh WITHOUT blocking.
 * Returns the current (possibly stale) snapshot immediately.
 *
 * Use this for synchronous callers (e.g., getOpenAIClient).
 *
 * @returns {AIConfigSnapshot}
 */
export function getCachedAIConfigSnapshot() {
  if (!currentSnapshot) {
    currentSnapshot = getEnvFallbackSnapshot();
    markAiConfigHealth({
      status: 'degraded',
      source: currentSnapshot.source,
      reason: 'Using local fallback until Worker config refresh succeeds',
    });
    // Fire background refresh to populate from Worker ASAP
    refreshAIConfig().catch(() => {}); // swallow, already logged inside
    return currentSnapshot;
  }

  if (hasSnapshotExpired(currentSnapshot)) {
    // Start background refresh without awaiting
    refreshAIConfig().catch(() => {});
  }

  return currentSnapshot;
}

/**
 * Get the current AI config, awaiting fresh data if no cache exists.
 *
 * - If a fresh snapshot is cached, returns immediately.
 * - If expired, returns stale snapshot (background refresh already started by getCachedAIConfigSnapshot).
 * - If no snapshot at all, awaits fresh data from Worker (or env fallback on failure).
 *
 * Use this for async callers that can afford to wait on first call.
 *
 * @returns {Promise<AIConfigSnapshot>}
 */
export async function getDynamicAIConfig() {
  if (!currentSnapshot) {
    return refreshAIConfig();
  }

  if (hasSnapshotExpired(currentSnapshot)) {
    // Return stale while refresh runs in background
    refreshAIConfig().catch(() => {});
  }

  return currentSnapshot;
}

/**
 * Force-invalidate the current cache snapshot and in-flight refresh.
 * Next call to getCachedAIConfigSnapshot / getDynamicAIConfig will start fresh.
 */
export function invalidateAIConfigCache() {
  currentSnapshot = null;
  refreshPromise = null;
  currentProviderSnapshot = null;
  providerRefreshPromise = null;
  aiConfigHealth = {
    status: 'unknown',
    source: 'none',
    reason: null,
    updatedAt: new Date().toISOString(),
  };
  logger.info({ operation: 'invalidate' }, 'AI config cache invalidated');
}

/**
 * Start a background refresh proactively (e.g., on server startup).
 * Safe to call multiple times — collapses into single in-flight fetch.
 */
export function primeAIConfigRefresh() {
  const workerApiUrl = config.services?.workerApiUrl;
  if (!workerApiUrl) {
    markAiConfigHealth({
      status: 'degraded',
      source: 'env',
      reason: 'WORKER_API_URL is not configured',
    });
    logger.warn(
      { operation: 'prime' },
      '⚠️  WORKER_API_URL is not configured. AI config will use local env fallback only. ' +
      'Set WORKER_API_URL in .env to enable centralized AI config from the Worker.',
    );
    return;
  }

  refreshAIConfig().catch((err) => {
    logger.warn({ operation: 'prime' }, 'Primed refresh failed', { error: err.message });
  });
}

// =============================================================================
// Provider Snapshot — multi-provider config from Worker
// =============================================================================

/**
 * Fetch full provider/model/route snapshot from Worker internal endpoint.
 * @returns {Promise<ProviderSnapshot>}
 */
async function fetchWorkerProviderSnapshot() {
  const workerApiUrl = config.services?.workerApiUrl;
  if (!workerApiUrl) {
    throw new Error('WORKER_API_URL not configured');
  }

  const backendKey = config.backendKey;
  if (!backendKey) {
    throw new Error('BACKEND_KEY not configured — cannot authenticate with Worker');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${workerApiUrl}/api/v1/internal/ai-config/providers`, {
      method: 'GET',
      headers: {
        'X-Backend-Key': backendKey,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Worker returned HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!json.ok || !json.data) {
      throw new Error('Worker returned unexpected response shape');
    }

    const { providers, models, defaultRoute } = json.data;
    const now = Date.now();

    return {
      source: 'worker',
      providers: providers || [],
      models: models || [],
      defaultRoute: defaultRoute || null,
      fetchedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Background refresh for provider snapshot.
 * Collapses concurrent calls into a single in-flight promise.
 * @returns {Promise<ProviderSnapshot>}
 */
async function refreshProviderSnapshot() {
  if (providerRefreshPromise) return providerRefreshPromise;

  providerRefreshPromise = (async () => {
    try {
      const snapshot = await fetchWorkerProviderSnapshot();
      currentProviderSnapshot = snapshot;

      logger.info(
        { operation: 'provider-refresh', source: snapshot.source },
        'Provider snapshot updated from Worker',
        { providerCount: snapshot.providers.length, modelCount: snapshot.models.length },
      );

      return snapshot;
    } catch (err) {
      logger.warn(
        { operation: 'provider-refresh' },
        'Failed to fetch provider snapshot from Worker',
        { error: err.message },
      );

      // Extend current snapshot TTL if available
      if (currentProviderSnapshot) {
        currentProviderSnapshot = {
          ...currentProviderSnapshot,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        return currentProviderSnapshot;
      }

      // No fallback — return null-ish snapshot so caller can degrade gracefully
      return null;
    } finally {
      providerRefreshPromise = null;
    }
  })();

  return providerRefreshPromise;
}

/**
 * Get the cached provider snapshot, triggering a background refresh if expired.
 *
 * Returns null when WORKER_API_URL is not configured or no snapshot has been
 * fetched yet (callers should fall back to their own degradation logic).
 *
 * @returns {Promise<ProviderSnapshot | null>}
 */
export async function getProviderSnapshot() {
  if (!config.services?.workerApiUrl) {
    return null;
  }

  if (!currentProviderSnapshot) {
    return refreshProviderSnapshot();
  }

  if (Date.now() >= currentProviderSnapshot.expiresAt) {
    // Return stale while refresh runs in background
    refreshProviderSnapshot().catch(() => {});
  }

  return currentProviderSnapshot;
}
