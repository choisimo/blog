import { describe, expect, it } from 'vitest';
import { CONFIG_KEYS } from '../src/lib/config';
import { buildConfigReadiness } from '../src/lib/config-readiness';
import type { Env } from '../src/types';

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENV: 'production',
    JWT_SECRET: 'jwt-secret',
    BACKEND_KEY: 'backend-key',
    GATEWAY_SIGNING_SECRET: 'gateway-signing-secret',
    BACKEND_ORIGIN: 'https://backend.example',
    SECRETS_ENCRYPTION_KEY: 'encryption-key',
    DB: {} as D1Database,
    R2: {} as R2Bucket,
    KV: {} as KVNamespace,
    ...overrides,
  };
}

describe('Worker config registry readiness', () => {
  it('keeps secret-like API key out of mutable dynamic config keys', () => {
    expect(Object.keys(CONFIG_KEYS)).not.toContain('AI_SERVE_API_KEY');
  });

  it('reports required Worker config without exposing values', () => {
    const readiness = buildConfigReadiness(baseEnv({ JWT_SECRET: undefined as unknown as string }));

    expect(readiness.ok).toBe(false);
    expect(readiness.missing).toContain('JWT_SECRET');
    expect(JSON.stringify(readiness)).not.toContain('backend-key');
    expect(JSON.stringify(readiness)).not.toContain('gateway-signing-secret');
  });

  it('rejects protected placeholder values as not ready', () => {
    const readiness = buildConfigReadiness(baseEnv({ BACKEND_KEY: 'replace-me' }));

    expect(readiness.ok).toBe(false);
    expect(readiness.placeholders).toContain('BACKEND_KEY');
  });
});
