import {
  evaluateRequiredConfig,
  isPlaceholderConfigValue,
} from '@blog/shared/contracts/config-registry';
import type { Env } from '../types';

const PROTECTED_ENVS = new Set(['production', 'staging']);

export type ConfigReadinessCheck = {
  key: string;
  configured: boolean;
  placeholder: boolean;
  source: string;
  classification: string;
};

export type ConfigReadinessPayload = {
  ok: boolean;
  status: 'ready' | 'degraded';
  service: string;
  env: string;
  protectedEnvironment: boolean;
  missing: string[];
  placeholders: string[];
  checks: ConfigReadinessCheck[];
};

export function buildConfigReadiness(
  env: Env,
  service = 'api-gateway'
): ConfigReadinessPayload {
  const envName = env.ENV || 'development';
  const protectedEnvironment = PROTECTED_ENVS.has(envName);
  const source = env as unknown as Record<string, unknown>;
  const checks = evaluateRequiredConfig(service, source).map((check) => {
    const rawValue = source[check.key];
    return {
      key: check.key,
      configured: check.configured,
      placeholder: protectedEnvironment && isPlaceholderConfigValue(rawValue),
      source: check.source,
      classification: check.classification,
    };
  });
  const missing = checks.filter((check) => !check.configured).map((check) => check.key);
  const placeholders = checks.filter((check) => check.placeholder).map((check) => check.key);
  const ok = missing.length === 0 && placeholders.length === 0;

  return {
    ok,
    status: ok ? 'ready' : 'degraded',
    service,
    env: envName,
    protectedEnvironment,
    missing,
    placeholders,
    checks,
  };
}
