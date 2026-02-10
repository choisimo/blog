import { Context } from 'hono';
import type { Env } from '../types';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://noblog.nodove.com',
  'https://blog.nodove.com',
  'https://nodove.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8081',
  'http://localhost:8081',
];

export function getAllowedOrigins(env: Env): string[] {
  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
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

export function getCorsHeadersForRequest(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || undefined;
  const allowed = isOriginAllowed(origin, env);

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
