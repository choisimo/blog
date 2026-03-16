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
        return currentSnapshot;
      }

      const fallback = getEnvFallbackSnapshot();
      currentSnapshot = fallback;
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
  logger.info({ operation: 'invalidate' }, 'AI config cache invalidated');
}

/**
 * Start a background refresh proactively (e.g., on server startup).
 * Safe to call multiple times — collapses into single in-flight fetch.
 */
export function primeAIConfigRefresh() {
  refreshAIConfig().catch((err) => {
    logger.warn({ operation: 'prime' }, 'Primed refresh failed', { error: err.message });
  });
}
