import { Hono } from 'hono';
import type { Env } from '../types';
import { success, badRequest, unauthorized } from '../lib/response';
import { signJwt, verifyJwt } from '../lib/jwt';

const auth = new Hono<{ Bindings: Env }>();

// POST /auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { username, password } = body;

  if (!username || !password) {
    return badRequest(c, 'username and password required');
  }

  // For migration compatibility, check env vars first
  // TODO: After migration, check D1 users table
  const adminUsername = c.env.ADMIN_USERNAME;
  const adminPassword = c.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    return unauthorized(c, 'Authentication not configured');
  }

  if (username !== adminUsername || password !== adminPassword) {
    return unauthorized(c, 'Invalid credentials');
  }

  const token = await signJwt(
    {
      sub: 'admin',
      role: 'admin',
      username: adminUsername,
    },
    c.env
  );

  return success(c, { token });
});

// GET /auth/me
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return unauthorized(c, 'Missing Authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return unauthorized(c, 'Invalid Authorization format');
  }

  try {
    const claims = await verifyJwt(token, c.env);
    return success(c, { claims });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return unauthorized(c, message);
  }
});

export default auth;
