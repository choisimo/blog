import { Context, Next } from 'hono';
import type { Env } from '../types';
import { verifyJwt } from '../lib/jwt';
import { unauthorized, forbidden } from '../lib/response';

/**
 * Require any authenticated user
 */
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

    // Reject refresh tokens - only access tokens allowed
    if (payload.type === 'refresh') {
      return unauthorized(c, 'Invalid token type');
    }

    // Store user info in context for downstream handlers
    c.set('user', payload);
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    return unauthorized(c, message);
  }
}

/**
 * Require admin role with email verification
 *
 * This middleware ensures:
 * 1. Valid access token (not refresh token)
 * 2. User has 'admin' role
 * 3. Email has been verified via OTP
 */
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

    // Reject refresh tokens - only access tokens allowed
    if (payload.type === 'refresh') {
      return unauthorized(c, 'Invalid token type. Use access token.');
    }

    // Check admin role
    if (payload.role !== 'admin') {
      return forbidden(c, 'Admin role required');
    }

    // Check email verification
    if (!payload.emailVerified) {
      return forbidden(c, 'Email verification required');
    }

    // Store user info in context
    c.set('user', payload);
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    return unauthorized(c, message);
  }
}

/**
 * Require admin role (without email verification requirement)
 * Use this for less sensitive admin operations if needed
 */
export async function requireAdminBasic(c: Context, next: Next) {
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

    if (payload.type === 'refresh') {
      return unauthorized(c, 'Invalid token type');
    }

    if (payload.role !== 'admin') {
      return forbidden(c, 'Admin role required');
    }

    c.set('user', payload);
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    return unauthorized(c, message);
  }
}
