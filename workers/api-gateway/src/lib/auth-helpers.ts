import { verifyJwt } from './jwt';
import type { Env } from '../types';

/**
 * Extract user ID from JWT token in the Authorization header.
 * Returns null if the header is missing, the token is invalid, or it's a refresh token.
 */
export async function getUserIdFromToken(c: { req: { header(name: string): string | undefined }; env: Env }): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const payload = await verifyJwt(token, c.env);
    // Reject refresh tokens
    if (payload.type === 'refresh') return null;
    return payload.sub || null;
  } catch {
    return null;
  }
}
