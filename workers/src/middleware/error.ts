import { Context } from 'hono';
import { error } from '../lib/response';

export function errorHandler(err: Error, c: Context) {
  console.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    requestId: c.get('requestId'),
  });

  const status = (err as { status?: number }).status || 500;
  return error(c, err.message || 'Internal Server Error', status);
}
