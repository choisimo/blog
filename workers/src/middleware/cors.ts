import { Context, Next } from 'hono';
import { setCorsHeaders } from '../lib/cors';

export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header('Origin');

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    setCorsHeaders(c, origin);
    return c.text('', 204);
  }

  // Set CORS headers for actual requests
  setCorsHeaders(c, origin);
  await next();
}
