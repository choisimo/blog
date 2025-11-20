import { Context, Next } from 'hono';

export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  const method = c.req.method;
  const path = c.req.path;

  // Store request ID for downstream use
  c.set('requestId', requestId);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Structured logging
  console.log(
    JSON.stringify({
      requestId,
      method,
      path,
      status,
      duration,
      timestamp: new Date().toISOString(),
    })
  );
}
