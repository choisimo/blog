import { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiResponse } from '../types';

export type PaginationMeta = {
  cursor?: string | null;
  hasMore?: boolean;
};

export function success<T>(
  c: Context,
  data: T,
  status: ContentfulStatusCode = 200,
  pagination?: PaginationMeta
) {
  const response: ApiResponse<T> & PaginationMeta = { ok: true, data };
  if (pagination) {
    if (pagination.cursor !== undefined) response.cursor = pagination.cursor;
    if (pagination.hasMore !== undefined) response.hasMore = pagination.hasMore;
  }
  return c.json(response, { status });
}

export function error(
  c: Context,
  message: string,
  status: ContentfulStatusCode = 500,
  code?: string
) {
  return c.json<ApiResponse>(
    {
      ok: false,
      error: { message, code },
    },
    { status }
  );
}

export function notFound(c: Context, message = 'Not Found') {
  return error(c, message, 404, 'NOT_FOUND');
}

export function badRequest(c: Context, message: string) {
  return error(c, message, 400, 'BAD_REQUEST');
}

export function unauthorized(c: Context, message = 'Unauthorized') {
  return error(c, message, 401, 'UNAUTHORIZED');
}

export function forbidden(c: Context, message = 'Forbidden') {
  return error(c, message, 403, 'FORBIDDEN');
}

export function conflict(c: Context, message: string) {
  return error(c, message, 409, 'CONFLICT');
}

export function serverError(c: Context, message = 'Internal Server Error') {
  return error(c, message, 500, 'INTERNAL_ERROR');
}
