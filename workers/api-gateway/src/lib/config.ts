/**
 * Dynamic configuration via KV
 *
 * 모든 AI 호출은 자체 백엔드 서버(api.nodove.com)를 통해 처리됩니다.
 * 이 모듈은 KV 스토리지를 통해 런타임에 서버 URL을 변경할 수 있게 합니다.
 *
 * KV Keys:
 * - config:ai_serve_url     - AI 서버 URL (api.nodove.com)
 * - config:ai_serve_api_key - AI 서버 API 키
 * - config:api_base_url     - 백엔드 API URL (api.nodove.com)
 * - config:ai_default_model - 백엔드 강제 기본 모델
 * - config:ai_vision_model  - 비전 강제 모델
 * - config:perplexity_model - 웹 검색 기본 모델
 *
 * Priority:
 * 1. D1 Secret (if set)
 * 2. KV value (if set)
 * 3. Environment variable
 * 4. Hardcoded default
 */

import type { Env } from '../types';
import { getSecret } from './secrets';

// KV key constants
export const CONFIG_KEYS = {
  AI_SERVE_URL: 'config:ai_serve_url',
  AI_SERVE_API_KEY: 'config:ai_serve_api_key',
  API_BASE_URL: 'config:api_base_url',
  AI_DEFAULT_MODEL: 'config:ai_default_model',
  AI_VISION_MODEL: 'config:ai_vision_model',
  PERPLEXITY_MODEL: 'config:perplexity_model',
} as const;

// Default fallback URLs (used if both KV and env are empty)
const DEFAULTS = {
  AI_SERVE_URL: 'https://blog-b.nodove.com',
  API_BASE_URL: 'https://api.nodove.com',
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
 * Get optional config value with priority: D1 secret > KV > env
 */
async function getOptionalConfigWithSecret(
  env: Env,
  secretKey: string,
  kvKey: string,
  envValue: string | undefined
): Promise<string | undefined> {
  const secretValue = await getSecret(env, secretKey);
  if (secretValue) return secretValue;
  return getOptionalConfig(env.KV, kvKey, envValue);
}

/**
 * Get AI Serve URL (for AI server like ai-check.nodove.com)
 */
export async function getAiServeUrl(env: Env): Promise<string> {
  return getConfig(
    env.KV,
    CONFIG_KEYS.AI_SERVE_URL,
    (await getSecret(env, 'AI_SERVER_URL')) || env.AI_SERVER_URL,
    DEFAULTS.AI_SERVE_URL
  );
}

/**
 * Get AI Serve API Key (optional)
 */
export async function getAiServeApiKey(env: Env): Promise<string | undefined> {
  return getOptionalConfigWithSecret(
    env,
    'AI_API_KEY',
    CONFIG_KEYS.AI_SERVE_API_KEY,
    env.AI_API_KEY
  );
}

/**
 * Get Backend API Base URL (via Cloudflare Tunnel)
 */
export async function getApiBaseUrl(env: Env): Promise<string> {
  return getConfig(
    env.KV,
    CONFIG_KEYS.API_BASE_URL,
    (await getSecret(env, 'API_BASE_URL')) || env.API_BASE_URL,
    DEFAULTS.API_BASE_URL
  );
}

/**
 * Get forced default chat model (if configured)
 */
export async function getAiDefaultModel(env: Env): Promise<string | undefined> {
  return getOptionalConfigWithSecret(
    env,
    'AI_DEFAULT_MODEL',
    CONFIG_KEYS.AI_DEFAULT_MODEL,
    env.AI_DEFAULT_MODEL
  );
}

/**
 * Get forced vision model (if configured)
 */
export async function getAiVisionModel(env: Env): Promise<string | undefined> {
  return getOptionalConfigWithSecret(
    env,
    'AI_VISION_MODEL',
    CONFIG_KEYS.AI_VISION_MODEL,
    env.AI_VISION_MODEL
  );
}

/**
 * Get default Perplexity model (if configured)
 */
export async function getPerplexityModel(env: Env): Promise<string | undefined> {
  return getOptionalConfigWithSecret(
    env,
    'PERPLEXITY_MODEL',
    CONFIG_KEYS.PERPLEXITY_MODEL,
    env.PERPLEXITY_MODEL
  );
}

/**
 * Set a config value in KV
 */
export async function setConfigValue(
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
export async function deleteConfigValue(
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
  aiServeUrl: { value: string; source: 'db' | 'kv' | 'env' | 'default' };
  apiBaseUrl: { value: string; source: 'db' | 'kv' | 'env' | 'default' };
  aiServeApiKey: { value: string; source: 'db' | 'kv' | 'env' | 'none' } | null;
  aiDefaultModel: { value: string; source: 'db' | 'kv' | 'env' | 'none' } | null;
  aiVisionModel: { value: string; source: 'db' | 'kv' | 'env' | 'none' } | null;
  perplexityModel: { value: string; source: 'db' | 'kv' | 'env' | 'none' } | null;
}> {
  const kv = env.KV;

  // AI Serve URL - check D1 first
  const aiServeDb = await getSecret(env, 'AI_SERVER_URL');
  let aiServeUrl: { value: string; source: 'db' | 'kv' | 'env' | 'default' };
  if (aiServeDb) {
    aiServeUrl = { value: aiServeDb, source: 'db' as const };
  } else {
    const aiServeKv = await kv.get(CONFIG_KEYS.AI_SERVE_URL);
    aiServeUrl = aiServeKv
      ? { value: aiServeKv, source: 'kv' as const }
      : env.AI_SERVER_URL
        ? { value: env.AI_SERVER_URL, source: 'env' as const }
        : { value: DEFAULTS.AI_SERVE_URL, source: 'default' as const };
  }

  // API Base URL - check D1 first
  const apiBaseDb = await getSecret(env, 'API_BASE_URL');
  let apiBaseUrl: { value: string; source: 'db' | 'kv' | 'env' | 'default' };
  if (apiBaseDb) {
    apiBaseUrl = { value: apiBaseDb, source: 'db' as const };
  } else {
    const apiBaseKv = await kv.get(CONFIG_KEYS.API_BASE_URL);
    apiBaseUrl = apiBaseKv
      ? { value: apiBaseKv, source: 'kv' as const }
      : env.API_BASE_URL
        ? { value: env.API_BASE_URL, source: 'env' as const }
        : { value: DEFAULTS.API_BASE_URL, source: 'default' as const };
  }

  // AI API Key - check D1 first
  const aiKeyDb = await getSecret(env, 'AI_API_KEY');
  let aiServeApiKey: { value: string; source: 'db' | 'kv' | 'env' | 'none' } | null;
  if (aiKeyDb) {
    aiServeApiKey = { value: '***' + aiKeyDb.slice(-4), source: 'db' as const };
  } else {
    const aiServeApiKeyKv = await kv.get(CONFIG_KEYS.AI_SERVE_API_KEY);
    aiServeApiKey = aiServeApiKeyKv
      ? { value: '***' + aiServeApiKeyKv.slice(-4), source: 'kv' as const }
      : env.AI_API_KEY
        ? { value: '***' + env.AI_API_KEY.slice(-4), source: 'env' as const }
        : null;
  }

  const aiDefaultDb = await getSecret(env, 'AI_DEFAULT_MODEL');
  const aiDefaultKv = aiDefaultDb ? null : await kv.get(CONFIG_KEYS.AI_DEFAULT_MODEL);
  const aiDefaultModel = aiDefaultDb
    ? { value: aiDefaultDb, source: 'db' as const }
    : aiDefaultKv
      ? { value: aiDefaultKv, source: 'kv' as const }
      : env.AI_DEFAULT_MODEL
        ? { value: env.AI_DEFAULT_MODEL, source: 'env' as const }
        : null;

  const aiVisionDb = await getSecret(env, 'AI_VISION_MODEL');
  const aiVisionKv = aiVisionDb ? null : await kv.get(CONFIG_KEYS.AI_VISION_MODEL);
  const aiVisionModel = aiVisionDb
    ? { value: aiVisionDb, source: 'db' as const }
    : aiVisionKv
      ? { value: aiVisionKv, source: 'kv' as const }
      : env.AI_VISION_MODEL
        ? { value: env.AI_VISION_MODEL, source: 'env' as const }
        : null;

  const perplexityDb = await getSecret(env, 'PERPLEXITY_MODEL');
  const perplexityKv = perplexityDb ? null : await kv.get(CONFIG_KEYS.PERPLEXITY_MODEL);
  const perplexityModel = perplexityDb
    ? { value: perplexityDb, source: 'db' as const }
    : perplexityKv
      ? { value: perplexityKv, source: 'kv' as const }
      : env.PERPLEXITY_MODEL
        ? { value: env.PERPLEXITY_MODEL, source: 'env' as const }
        : null;

  return {
    aiServeUrl,
    apiBaseUrl,
    aiServeApiKey,
    aiDefaultModel,
    aiVisionModel,
    perplexityModel,
  };
}

/**
 * Clear the in-memory cache (useful for testing or force refresh)
 */
export function clearConfigCache(): void {
  cache.clear();
}
