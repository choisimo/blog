import type { Env } from '../types';

export interface DynamicProvider {
  id: string;
  name: string;
  displayName: string;
  apiBaseUrl: string | null;
  apiKeyEnv: string | null;
  isEnabled: boolean;
  healthStatus: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastHealthCheck: string | null;
}

interface DBProvider {
  id: string;
  name: string;
  display_name: string;
  api_base_url: string | null;
  api_key_env: string | null;
  is_enabled: number;
  health_status: string;
  last_health_check: string | null;
}

const PROVIDER_CACHE_KEY = 'config:ai_providers';
const PROVIDER_CACHE_TTL = 60;

const DEFAULT_PROVIDERS: DynamicProvider[] = [
  {
    id: 'prov_gemini',
    name: 'gemini',
    displayName: 'Google Gemini',
    apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnv: 'GEMINI_API_KEY',
    isEnabled: true,
    healthStatus: 'unknown',
    lastHealthCheck: null,
  },
];

function mapDBToProvider(db: DBProvider): DynamicProvider {
  return {
    id: db.id,
    name: db.name,
    displayName: db.display_name,
    apiBaseUrl: db.api_base_url,
    apiKeyEnv: db.api_key_env,
    isEnabled: db.is_enabled === 1,
    healthStatus: db.health_status as DynamicProvider['healthStatus'],
    lastHealthCheck: db.last_health_check,
  };
}

export async function getProvidersFromDB(env: Env): Promise<DynamicProvider[]> {
  try {
    const cached = await env.KV.get(PROVIDER_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as DynamicProvider[];
    }

    const result = await env.DB.prepare(
      `SELECT * FROM ai_providers WHERE is_enabled = 1 ORDER BY display_name ASC`
    ).all<DBProvider>();

    if (!result.results || result.results.length === 0) {
      return DEFAULT_PROVIDERS;
    }

    const providers = result.results.map(mapDBToProvider);

    await env.KV.put(PROVIDER_CACHE_KEY, JSON.stringify(providers), {
      expirationTtl: PROVIDER_CACHE_TTL,
    });

    return providers;
  } catch (err) {
    console.error('Failed to load providers from DB:', err);
    return DEFAULT_PROVIDERS;
  }
}

export async function getProviderById(env: Env, id: string): Promise<DynamicProvider | null> {
  const providers = await getProvidersFromDB(env);
  return providers.find((p) => p.id === id) || null;
}

export async function getProviderByName(env: Env, name: string): Promise<DynamicProvider | null> {
  const providers = await getProvidersFromDB(env);
  return providers.find((p) => p.name === name) || null;
}

export async function invalidateProviderCache(env: Env): Promise<void> {
  await env.KV.delete(PROVIDER_CACHE_KEY);
}

export async function killSwitchProvider(
  env: Env,
  providerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const enabledCount = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM ai_providers WHERE is_enabled = 1 AND id != ?`
    )
      .bind(providerId)
      .first<{ count: number }>();

    if (!enabledCount || enabledCount.count === 0) {
      return { success: false, error: 'Cannot disable the last enabled provider' };
    }

    await env.DB.prepare(
      `UPDATE ai_providers SET is_enabled = 0, health_status = 'down', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
      .bind(providerId)
      .run();

    await invalidateProviderCache(env);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function enableProvider(
  env: Env,
  providerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await env.DB.prepare(
      `UPDATE ai_providers SET is_enabled = 1, health_status = 'unknown', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
      .bind(providerId)
      .run();

    await invalidateProviderCache(env);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function updateProviderHealth(
  env: Env,
  providerId: string,
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
): Promise<void> {
  await env.DB.prepare(
    `UPDATE ai_providers SET health_status = ?, last_health_check = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  )
    .bind(status, providerId)
    .run();

  await invalidateProviderCache(env);
}
