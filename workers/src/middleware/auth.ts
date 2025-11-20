import { Context, Next } from 'hono';
import type { Env } from '../types';
import { verifyJwt } from '../lib/jwt';
import { unauthorized } from '../lib/response';

export async function requireAuth(c: Context, next: Next) {
  const env = c.env as Env;
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return unauthorized(c, 'Missing Authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return unauthorized(c, 'Invalid Authorization header format');
  }

  try {
    const payload = await verifyJwt(token, env);
    // Store user info in context for downstream handlers
    c.set('user', payload);
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    return unauthorized(c, message);
  }
}

export async function requireAdmin(c: Context, next: Next) {
  const env = c.env as Env;
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return unauthorized(c, 'Missing Authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return unauthorized(c, 'Invalid Authorization header format');
  }

  try {
    const payload = await verifyJwt(token, env);
    if (payload.role !== 'admin') {
      return unauthorized(c, 'Admin role required');
    }
    c.set('user', payload);
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    return unauthorized(c, message);
  }
}
