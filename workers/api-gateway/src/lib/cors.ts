import { Context } from 'hono';
import type { Env } from '../types';

export function getAllowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | undefined, env: Env): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins(env);
  return allowed.includes(origin);
}

export function setCorsHeaders(c: Context, origin?: string) {
  const env = c.env as Env;
  const allowed = isOriginAllowed(origin, env);

  if (allowed && origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }

  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
  c.header('Access-Control-Max-Age', '86400');
}
