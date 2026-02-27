import dotenv from 'dotenv';
import path from 'node:path';
import { CONSUL, CACHE_TTL } from './constants.js';

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

let consulClient = null;
let consulCache = new Map();

export async function initConsul() {
  if (!CONSUL.ENABLED || consulClient) return consulClient;

  try {
    const Consul = (await import('consul')).default;
    consulClient = new Consul({
      host: CONSUL.HOST,
      port: CONSUL.PORT,
      promisify: true,
    });

    const leader = await consulClient.status.leader();
    if (leader) {
      console.log(`[config] Consul connected: ${CONSUL.HOST}:${CONSUL.PORT}`);
    }
    return consulClient;
  } catch (err) {
    console.warn(`[config] Consul unavailable, using environment: ${err.message}`);
    return null;
  }
}

export async function consulGet(key) {
  if (!CONSUL.ENABLED) return null;

  const cacheKey = `kv:${key}`;
  const cached = consulCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL.CONSUL) {
    return cached.value;
  }

  try {
    const client = await initConsul();
    if (!client) return null;

    const result = await client.kv.get(`${CONSUL.PREFIX}/${key}`);
    if (result?.Value) {
      let value;
      try {
        value = JSON.parse(result.Value);
      } catch {
        value = result.Value;
      }
      consulCache.set(cacheKey, { value, ts: Date.now() });
      return value;
    }
  } catch (err) {
    console.warn(`[config] Consul get failed for ${key}: ${err.message}`);
  }
  return null;
}

const CONSUL_KEYS = [
  ['config/domains/frontend', 'SITE_BASE_URL'],
  ['config/domains/api', 'API_BASE_URL'],
  ['config/domains/assets', 'ASSETS_BASE_URL'],
  ['config/domains/terminal', 'TERMINAL_GATEWAY_URL'],
  ['config/cors/allowed_origins', 'ALLOWED_ORIGINS'],
  ['config/features/ai_enabled', 'FEATURE_AI_ENABLED'],
  ['config/features/rag_enabled', 'FEATURE_RAG_ENABLED'],
  ['config/features/terminal_enabled', 'FEATURE_TERMINAL_ENABLED'],
  ['config/features/ai_inline', 'FEATURE_AI_INLINE'],
  ['config/features/comments_enabled', 'FEATURE_COMMENTS_ENABLED'],
  ['services/ai/url', 'AI_SERVER_URL'],
  ['services/embedding/url', 'AI_EMBEDDING_URL'],
  ['services/embedding/api_key', 'AI_EMBEDDING_API_KEY'],
  ['services/embedding/model', 'AI_EMBED_MODEL'],
  ['services/chromadb/url', 'CHROMA_URL'],
  ['services/chromadb/collection', 'CHROMA_COLLECTION'],
  ['services/redis/url', 'REDIS_URL'],
  ['services/backend/url', 'INTERNAL_API_URL'],
  ['services/terminal/url', 'TERMINAL_SERVER_URL'],
];

export async function loadConsulConfig() {
  if (!CONSUL.ENABLED) return {};

  const config = {};
  await Promise.all(
    CONSUL_KEYS.map(async ([consulKey, envKey]) => {
      const value = await consulGet(consulKey);
      if (value !== null) {
        config[envKey] = Array.isArray(value) ? value.join(',') : value;
      }
    })
  );

  return config;
}

export { consulClient, consulCache };
