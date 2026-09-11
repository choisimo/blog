import type { Env, JwtPayload } from '../types';

export const ANONYMOUS_SUB_PATTERN = /^anon-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class AnonymousAuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 401 | 403 | 409 | 503,
    message: string,
  ) {
    super(message);
    this.name = 'AnonymousAuthError';
  }
}

export function readBearerToken(header?: string | null): string | null {
  if (!header || header.length > 8200) return null;
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header);
  return match?.[1] ?? null;
}

export function isAnonymousIdentity(payload: JwtPayload): boolean {
  return payload.role === 'anonymous' || payload.tokenClass === 'anonymous' ||
    (typeof payload.sub === 'string' && payload.sub.startsWith('anon-'));
}

export function assertAnonymousClaims(payload: JwtPayload): void {
  if (payload.role !== 'anonymous' || payload.tokenClass !== 'anonymous' ||
      payload.type !== 'access' || !ANONYMOUS_SUB_PATTERN.test(payload.sub)) {
    throw new AnonymousAuthError('ANONYMOUS_PROOF_INVALID', 401, 'Valid anonymous ownership proof required');
  }
}

export async function anonymousSubjectHash(sub: string): Promise<string> {
  if (!ANONYMOUS_SUB_PATTERN.test(sub)) {
    throw new AnonymousAuthError('ANONYMOUS_PROOF_INVALID', 401, 'Invalid anonymous subject');
  }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`anonymous-revocation:v1:${sub}`));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function unavailable(): AnonymousAuthError {
  return new AnonymousAuthError('ANONYMOUS_AUTH_UNAVAILABLE', 503, 'Anonymous authentication temporarily unavailable');
}

/** No cache: a renewed token must not bypass a principal-wide revocation. */
export async function assertAnonymousNotRevoked(env: Env, sub: string): Promise<void> {
  const hash = await anonymousSubjectHash(sub);
  let revoked: { subject_hash: string } | null;
  try {
    revoked = await env.DB.prepare('SELECT subject_hash FROM anonymous_identity_revocations WHERE subject_hash = ?')
      .bind(hash).first<{ subject_hash: string }>();
  } catch {
    // Includes a missing migration. Never reinterpret a storage failure as a new identity.
    throw unavailable();
  }
  if (revoked) {
    throw new AnonymousAuthError('ANONYMOUS_PROOF_REVOKED', 401, 'Anonymous ownership proof has been revoked');
  }
}

export async function revokeAnonymousIdentity(env: Env, sub: string): Promise<void> {
  const hash = await anonymousSubjectHash(sub);
  try {
    await env.DB.prepare(`INSERT INTO anonymous_identity_revocations (subject_hash, revoked_at)
      VALUES (?, ?) ON CONFLICT(subject_hash) DO NOTHING`).bind(hash, new Date().toISOString()).run();
  } catch {
    throw unavailable();
  }
}
