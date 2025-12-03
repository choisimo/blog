/**
 * Dynamic configuration via KV
 *
 * This module provides functions to read/write AI server URLs and other
 * configuration from KV storage. This allows changing AI server domains
 * without redeploying the worker.
 *
 * KV Keys:
 * - config:ai_serve_url     - Custom AI server URL (ai-check, ai-serve)
 * - config:ai_call_url      - AI Call gateway URL
 * - config:ai_serve_api_key - API key for AI serve (optional override)
 *
 * Priority:
 * 1. KV value (if set)
 * 2. Environment variable
 * 3. Hardcoded default
 */

import type { Env } from '../types';

// KV key constants
export const CONFIG_KEYS = {
  AI_SERVE_URL: 'config:ai_serve_url',
  AI_CALL_URL: 'config:ai_call_url',
  AI_SERVE_API_KEY: 'config:ai_serve_api_key',
  AI_GATEWAY_CALLER_KEY: 'config:ai_gateway_caller_key',
} as const;

// Default fallback URLs (used if both KV and env are empty)
const DEFAULTS = {
  AI_SERVE_URL: 'https://ai-check.nodove.com',
  AI_CALL_URL: 'https://ai-call.nodove.com',
} as const;

// In-memory cache to reduce KV reads (TTL: 60 seconds)
type CacheEntry = { value: string | null; timestamp: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60 seconds

function getCached(key: string): string | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache(key: string, value: string | null): void {
  cache.set(key, { value, timestamp: Date.now() });
}

/**
 * Get a config value with priority: KV > env > default
 */
async function getConfig(
  kv: KVNamespace,
  kvKey: string,
  envValue: string | undefined,
  defaultValue: string
): Promise<string> {
  // Check cache first
  const cached = getCached(kvKey);
  if (cached !== undefined) {
    return cached || envValue || defaultValue;
  }

  try {
    const kvValue = await kv.get(kvKey);
    setCache(kvKey, kvValue);
    if (kvValue) return kvValue;
  } catch (err) {
    console.error(`Failed to read KV config ${kvKey}:`, err);
  }

  return envValue || defaultValue;
}

/**
 * Get optional config value (no default)
 */
async function getOptionalConfig(
  kv: KVNamespace,
  kvKey: string,
  envValue: string | undefined
): Promise<string | undefined> {
  const cached = getCached(kvKey);
  if (cached !== undefined) {
    return cached || envValue || undefined;
  }

  try {
    const kvValue = await kv.get(kvKey);
    setCache(kvKey, kvValue);
    if (kvValue) return kvValue;
  } catch (err) {
    console.error(`Failed to read KV config ${kvKey}:`, err);
  }

  return envValue;
}

/**
 * Get AI Serve URL (for custom AI server like ai-check, ai-serve)
 */
export async function getAiServeUrl(env: Env): Promise<string> {
  return getConfig(
    env.KV,
    CONFIG_KEYS.AI_SERVE_URL,
    env.AI_SERVE_BASE_URL,
    DEFAULTS.AI_SERVE_URL
  );
}

/**
 * Get AI Call URL (for AI Call gateway)
 */
export async function getAiCallUrl(env: Env): Promise<string> {
  return getConfig(
    env.KV,
    CONFIG_KEYS.AI_CALL_URL,
    env.AI_CALL_BASE_URL,
    DEFAULTS.AI_CALL_URL
  );
}

/**
 * Get AI Serve API Key (optional)
 */
export async function getAiServeApiKey(env: Env): Promise<string | undefined> {
  return getOptionalConfig(env.KV, CONFIG_KEYS.AI_SERVE_API_KEY, env.AI_SERVE_API_KEY);
}

/**
 * Get AI Gateway Caller Key (optional)
 */
export async function getAiGatewayCallerKey(env: Env): Promise<string | undefined> {
  return getOptionalConfig(
    env.KV,
    CONFIG_KEYS.AI_GATEWAY_CALLER_KEY,
    env.AI_GATEWAY_CALLER_KEY
  );
}

/**
 * Set a config value in KV
 */
export async function setConfig(
  kv: KVNamespace,
  key: keyof typeof CONFIG_KEYS,
  value: string
): Promise<void> {
  const kvKey = CONFIG_KEYS[key];
  await kv.put(kvKey, value);
  setCache(kvKey, value);
}

/**
 * Delete a config value from KV (will fall back to env/default)
 */
export async function deleteConfig(
  kv: KVNamespace,
  key: keyof typeof CONFIG_KEYS
): Promise<void> {
  const kvKey = CONFIG_KEYS[key];
  await kv.delete(kvKey);
  cache.delete(kvKey);
}

/**
 * Get all current config values (for debugging/admin)
 */
export async function getAllConfig(env: Env): Promise<{
  aiServeUrl: { value: string; source: 'kv' | 'env' | 'default' };
  aiCallUrl: { value: string; source: 'kv' | 'env' | 'default' };
  aiServeApiKey: { value: string; source: 'kv' | 'env' | 'none' } | null;
  aiGatewayCallerKey: { value: string; source: 'kv' | 'env' | 'none' } | null;
}> {
  const kv = env.KV;

  // AI Serve URL
  const aiServeKv = await kv.get(CONFIG_KEYS.AI_SERVE_URL);
  const aiServeUrl = aiServeKv
    ? { value: aiServeKv, source: 'kv' as const }
    : env.AI_SERVE_BASE_URL
      ? { value: env.AI_SERVE_BASE_URL, source: 'env' as const }
      : { value: DEFAULTS.AI_SERVE_URL, source: 'default' as const };

  // AI Call URL
  const aiCallKv = await kv.get(CONFIG_KEYS.AI_CALL_URL);
  const aiCallUrl = aiCallKv
    ? { value: aiCallKv, source: 'kv' as const }
    : env.AI_CALL_BASE_URL
      ? { value: env.AI_CALL_BASE_URL, source: 'env' as const }
      : { value: DEFAULTS.AI_CALL_URL, source: 'default' as const };

  // AI Serve API Key
  const aiServeApiKeyKv = await kv.get(CONFIG_KEYS.AI_SERVE_API_KEY);
  const aiServeApiKey = aiServeApiKeyKv
    ? { value: '***' + aiServeApiKeyKv.slice(-4), source: 'kv' as const }
    : env.AI_SERVE_API_KEY
      ? { value: '***' + env.AI_SERVE_API_KEY.slice(-4), source: 'env' as const }
      : null;

  // AI Gateway Caller Key
  const aiGatewayKeyKv = await kv.get(CONFIG_KEYS.AI_GATEWAY_CALLER_KEY);
  const aiGatewayCallerKey = aiGatewayKeyKv
    ? { value: '***' + aiGatewayKeyKv.slice(-4), source: 'kv' as const }
    : env.AI_GATEWAY_CALLER_KEY
      ? { value: '***' + env.AI_GATEWAY_CALLER_KEY.slice(-4), source: 'env' as const }
      : null;

  return {
    aiServeUrl,
    aiCallUrl,
    aiServeApiKey,
    aiGatewayCallerKey,
  };
}

/**
 * Clear the in-memory cache (useful for testing or force refresh)
 */
export function clearConfigCache(): void {
  cache.clear();
}
