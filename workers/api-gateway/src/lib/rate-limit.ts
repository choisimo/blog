import type { Context } from 'hono';
import type { HonoEnv } from '../types';
import { error } from './response';

export type KvRateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
  label: string;
  message: string;
  code?: string;
  logContext?: Record<string, unknown>;
};

function safeCount(value: string | null): number {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function markRateLimitStorageDegraded(
  c: Context<HonoEnv>,
  options: KvRateLimitOptions,
  phase: 'read' | 'write',
  err: unknown
): void {
  c.header('X-RateLimit-Storage', 'degraded');
  console.warn(`[${options.label}] rate-limit storage unavailable; allowing request`, {
    phase,
    error: getErrorMessage(err),
    ...(options.logContext ?? {}),
  });
}

export async function enforceKvRateLimit(
  c: Context<HonoEnv>,
  options: KvRateLimitOptions
): Promise<Response | null> {
  const kv = c.env.KV;
  if (!kv || options.limit <= 0 || options.windowSeconds <= 0) {
    return null;
  }

  let currentCount = 0;
  try {
    currentCount = safeCount(await kv.get(options.key));
  } catch (err) {
    markRateLimitStorageDegraded(c, options, 'read', err);
    return null;
  }

  if (currentCount >= options.limit) {
    return error(c, options.message, 429, options.code || 'RATE_LIMITED');
  }

  try {
    await kv.put(options.key, String(currentCount + 1), {
      expirationTtl: options.windowSeconds,
    });
  } catch (err) {
    markRateLimitStorageDegraded(c, options, 'write', err);
  }

  return null;
}
