import { Context, Next } from 'hono';
import { setCorsHeaders } from '../lib/cors';

export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header('Origin');

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    await setCorsHeaders(c, origin);
    return c.body(null, 204);
  }

  // Set CORS headers for actual requests
  await setCorsHeaders(c, origin);
  await next();
}
