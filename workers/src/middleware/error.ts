import { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { error } from '../lib/response';

const isContentfulStatus = (value: number): value is ContentfulStatusCode => {
  if (!Number.isInteger(value)) return false;
  return value !== 101 && value !== 204 && value !== 205 && value !== 304;
};

export function errorHandler(err: Error, c: Context) {
  console.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    requestId: c.get('requestId'),
  });

  const rawStatus = (err as { status?: number }).status;
  const status: ContentfulStatusCode = rawStatus && isContentfulStatus(rawStatus) ? rawStatus : 500;
  return error(c, err.message || 'Internal Server Error', status);
}
