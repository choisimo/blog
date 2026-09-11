import type { Env, JwtPayload } from '../types';
import { signJwt, verifyJwt } from './jwt';
import {
  AnonymousAuthError, assertAnonymousClaims, assertAnonymousNotRevoked,
  readBearerToken, revokeAnonymousIdentity,
} from './anonymous-identity';

export const ANONYMOUS_TOKEN_EXPIRY = 30 * 24 * 3600;

async function verifyProof(env: Env, header?: string): Promise<JwtPayload> {
  const token = readBearerToken(header);
  if (!token) throw new AnonymousAuthError('ANONYMOUS_PROOF_REQUIRED', 401, 'Anonymous ownership proof required');
  try {
    const claims = await verifyJwt(token, env);
    assertAnonymousClaims(claims);
    return claims;
  } catch (error) {
    if (error instanceof AnonymousAuthError) throw error;
    // Do not return parser input, tokens, signature diagnostics or DB internals.
    throw new AnonymousAuthError('ANONYMOUS_PROOF_INVALID', 401, 'Anonymous ownership proof is invalid or expired');
  }
}

async function issueForSubject(env: Env, sub: string) {
  await assertAnonymousNotRevoked(env, sub);
  const token = await signJwt({
    sub, role: 'anonymous', username: 'Anonymous', tokenClass: 'anonymous', type: 'access',
    jti: crypto.randomUUID(),
  }, env, ANONYMOUS_TOKEN_EXPIRY);
  return {
    token, userId: sub, tokenType: 'Bearer', expiresIn: ANONYMOUS_TOKEN_EXPIRY,
    expiresAt: new Date((Math.floor(Date.now() / 1000) + ANONYMOUS_TOKEN_EXPIRY) * 1000).toISOString(),
    isAnonymous: true,
  };
}

export async function issueAnonymousToken(env: Env, body: unknown, authorization?: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AnonymousAuthError('BAD_REQUEST', 400, 'Expected a JSON object');
  }
  const existingId = (body as { existingId?: unknown }).existingId;
  // Even a malformed hint must never be interpreted as permission to switch identities.
  if (existingId !== undefined || authorization !== undefined) {
    const claims = await verifyProof(env, authorization);
    if (existingId !== undefined && existingId !== claims.sub) {
      throw new AnonymousAuthError('ANONYMOUS_SUBJECT_MISMATCH', 403, 'Ownership proof does not match requested identity');
    }
    return issueForSubject(env, claims.sub);
  }
  return issueForSubject(env, `anon-${crypto.randomUUID()}`);
}

export async function renewAnonymousToken(env: Env, authorization?: string) {
  const claims = await verifyProof(env, authorization);
  return issueForSubject(env, claims.sub);
}

export async function revokeAnonymousToken(env: Env, authorization?: string) {
  const claims = await verifyProof(env, authorization);
  await revokeAnonymousIdentity(env, claims.sub);
  return { revoked: true, scope: 'anonymous-identity', dataDeleted: false } as const;
}
