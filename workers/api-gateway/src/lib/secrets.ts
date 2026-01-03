/**
 * Secrets Service
 *
 * Helper functions to retrieve secrets from centralized storage
 * with fallback to environment variables
 */

import { decryptSecret } from './crypto';
import type { Env, Secret } from '../types';

// In-memory cache for secrets (per-request)
const secretsCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Get a secret value by key name
 *
 * Priority:
 * 1. In-memory cache (if not expired)
 * 2. Database (encrypted)
 * 3. Environment variable fallback
 * 4. Default value (if provided)
 */
export async function getSecret(
  env: Env,
  keyName: string,
  defaultValue?: string
): Promise<string | null> {
  // 1. Check cache
  const cached = secretsCache.get(keyName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    // 2. Try database
    const secret = await env.DB.prepare(
      `SELECT encrypted_value, iv, env_fallback, default_value
       FROM secrets WHERE key_name = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`
    )
      .bind(keyName)
      .first<Pick<Secret, 'encrypted_value' | 'iv' | 'env_fallback' | 'default_value'>>();

    if (secret?.encrypted_value && secret?.iv) {
      const value = await decryptSecret(secret.encrypted_value, secret.iv, env);
      // Cache the decrypted value
      secretsCache.set(keyName, {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return value;
    }

    // 3. Try environment variable fallback
    const envKey = secret?.env_fallback || keyName;
    const envValue = (env as unknown as Record<string, string | undefined>)[envKey];
    if (envValue) {
      return envValue;
    }

    // 4. Use default value from DB or parameter
    return secret?.default_value || defaultValue || null;
  } catch (error) {
    console.error(`Failed to get secret ${keyName}:`, error);

    // Fallback to environment variable on error
    const envValue = (env as unknown as Record<string, string | undefined>)[keyName];
    return envValue || defaultValue || null;
  }
}

/**
 * Get multiple secrets at once (more efficient for batch operations)
 */
export async function getSecrets(
  env: Env,
  keyNames: string[]
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};

  // Check which keys are in cache
  const uncachedKeys: string[] = [];
  for (const key of keyNames) {
    const cached = secretsCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      result[key] = cached.value;
    } else {
      uncachedKeys.push(key);
    }
  }

  if (uncachedKeys.length === 0) {
    return result;
  }

  try {
    // Fetch uncached secrets from database
    const placeholders = uncachedKeys.map(() => '?').join(',');
    const secrets = await env.DB.prepare(
      `SELECT key_name, encrypted_value, iv, env_fallback, default_value
       FROM secrets WHERE key_name IN (${placeholders})
       AND (expires_at IS NULL OR expires_at > datetime('now'))`
    )
      .bind(...uncachedKeys)
      .all<
        Pick<Secret, 'key_name' | 'encrypted_value' | 'iv' | 'env_fallback' | 'default_value'>
      >();

    const secretMap = new Map(secrets.results.map((s) => [s.key_name, s]));

    for (const keyName of uncachedKeys) {
      const secret = secretMap.get(keyName);

      if (secret?.encrypted_value && secret?.iv) {
        try {
          const value = await decryptSecret(secret.encrypted_value, secret.iv, env);
          result[keyName] = value;
          secretsCache.set(keyName, {
            value,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
          continue;
        } catch {
          // Decryption failed, try fallback
        }
      }

      // Try environment variable
      const envKey = secret?.env_fallback || keyName;
      const envValue = (env as unknown as Record<string, string | undefined>)[envKey];

      result[keyName] = envValue || secret?.default_value || null;
    }
  } catch (error) {
    console.error('Failed to get secrets:', error);

    // Fallback to environment variables
    for (const keyName of uncachedKeys) {
      result[keyName] = (env as unknown as Record<string, string | undefined>)[keyName] || null;
    }
  }

  return result;
}

/**
 * Clear the secrets cache (call when secrets are updated)
 */
export function clearSecretsCache(keyName?: string): void {
  if (keyName) {
    secretsCache.delete(keyName);
  } else {
    secretsCache.clear();
  }
}

/**
 * Get AI provider API key
 * Convenience function for AI-related operations
 */
export async function getAIProviderKey(
  env: Env,
  providerId: string
): Promise<string | null> {
  // First try to get the secret_id from ai_providers
  const provider = await env.DB.prepare(
    `SELECT secret_id, api_key_env FROM ai_providers WHERE id = ? AND is_enabled = 1`
  )
    .bind(providerId)
    .first<{ secret_id: string | null; api_key_env: string | null }>();

  if (!provider) {
    return null;
  }

  // If secret_id is set, use centralized secrets
  if (provider.secret_id) {
    const secret = await env.DB.prepare(
      `SELECT key_name FROM secrets WHERE id = ?`
    )
      .bind(provider.secret_id)
      .first<{ key_name: string }>();

    if (secret) {
      return getSecret(env, secret.key_name);
    }
  }

  // Fallback to api_key_env (old method)
  if (provider.api_key_env) {
    return getSecret(env, provider.api_key_env);
  }

  return null;
}

/**
 * Check if required secrets are configured
 */
export async function checkRequiredSecrets(env: Env): Promise<{
  configured: string[];
  missing: string[];
}> {
  const result = await env.DB.prepare(
    `SELECT key_name, encrypted_value, env_fallback
     FROM secrets WHERE is_required = 1`
  ).all<{ key_name: string; encrypted_value: string | null; env_fallback: string | null }>();

  const configured: string[] = [];
  const missing: string[] = [];

  for (const secret of result.results) {
    if (secret.encrypted_value) {
      configured.push(secret.key_name);
    } else {
      // Check env fallback
      const envKey = secret.env_fallback || secret.key_name;
      const envValue = (env as unknown as Record<string, string | undefined>)[envKey];

      if (envValue) {
        configured.push(secret.key_name);
      } else {
        missing.push(secret.key_name);
      }
    }
  }

  return { configured, missing };
}
