import type { Env } from '../types';
import { verifyJwt } from './jwt';
import { AnonymousAuthError, readBearerToken } from './anonymous-identity';

/** Validate only client-supplied user credentials, before any server credential injection. */
export async function rejectInvalidForwardedAccess(request: Request, env: Env): Promise<Response | null> {
  const authorization = request.headers.get('Authorization');
  if (authorization === null) return null; // The route's own admission policy still applies.
  try {
    const token = readBearerToken(authorization);
    if (!token) throw new Error('Invalid access credential');
    const claims = await verifyJwt(token, env);
    if (claims.type !== 'access') throw new Error('Access token required');
    return null;
  } catch (cause) {
    const unavailable = cause instanceof AnonymousAuthError && cause.status === 503;
    return new Response(JSON.stringify({ ok: false, error: {
      code: unavailable ? 'AUTH_UNAVAILABLE' : 'UNAUTHORIZED',
      message: unavailable ? 'Authentication temporarily unavailable' : 'Valid access token required',
    } }), { status: unavailable ? 503 : 401, headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
      ...(unavailable ? { 'Retry-After': '30' } : {}),
    } });
  }
}
