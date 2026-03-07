import { Context } from 'hono';
import type { Env } from '../types';
import { getSecret } from './secrets';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://noblog.nodove.com',
  'https://blog.nodove.com',
  'https://nodove.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8081',
  'http://localhost:8081',
];

function parseAllowedOrigins(raw: string | null | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export async function getAllowedOrigins(env: Env): Promise<string[]> {
  const secretValue = await getSecret(env, 'ALLOWED_ORIGINS');
  const configured = parseAllowedOrigins(secretValue || env.ALLOWED_ORIGINS);

  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

export async function isOriginAllowed(origin: string | undefined, env: Env): Promise<boolean> {
  if (!origin) return false;
  const allowed = await getAllowedOrigins(env);
  return allowed.includes(origin);
}

export async function setCorsHeaders(c: Context, origin?: string): Promise<void> {
  const env = c.env as Env;
  const allowed = await isOriginAllowed(origin, env);

  if (allowed && origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }

  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  c.header('Access-Control-Max-Age', '86400');
}

export async function getCorsHeadersForRequest(
  request: Request,
  env: Env
): Promise<Record<string, string>> {
  const origin = request.headers.get('Origin') || undefined;
  const allowed = await isOriginAllowed(origin, env);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key',
    'Access-Control-Max-Age': '86400',
  };

  if (allowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}
