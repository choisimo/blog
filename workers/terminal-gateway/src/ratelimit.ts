/**
 * Terminal Gateway - Rate Limiting and Session Lease Tracking
 */

import type { RateLimitResult, SessionInfo } from './types';

const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX = 5;
const SESSION_TTL = 15 * 60;

function sessionKey(sessionId: string) {
  return `terminal:session:${sessionId}`;
}

function userKey(userId: string) {
  return `terminal:user:${userId}`;
}

export async function checkRateLimit(
  clientIP: string,
  kv: KVNamespace,
): Promise<RateLimitResult> {
  const key = `ratelimit:${clientIP}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    const data = await kv.get(key);
    let count = 0;
    let windowStart = now;

    if (data) {
      const parsed = JSON.parse(data) as { count?: number; windowStart?: number };
      if (parsed.windowStart && now - parsed.windowStart < RATE_LIMIT_WINDOW) {
        count = parsed.count || 0;
        windowStart = parsed.windowStart;
      }
    }

    if (count >= RATE_LIMIT_MAX) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowStart + RATE_LIMIT_WINDOW,
      };
    }

    count += 1;
    await kv.put(key, JSON.stringify({ count, windowStart }), {
      expirationTtl: RATE_LIMIT_WINDOW,
    });

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - count,
      resetAt: windowStart + RATE_LIMIT_WINDOW,
    };
  } catch (err) {
    console.error('Rate limit check failed:', err);
    return { allowed: true, remaining: 1, resetAt: now + RATE_LIMIT_WINDOW };
  }
}

export async function hasActiveSession(userId: string, kv: KVNamespace): Promise<boolean> {
  try {
    const raw = await kv.get(userKey(userId));
    if (!raw) return false;

    const info = JSON.parse(raw) as SessionInfo;
    const now = Date.now();
    if (now - info.lastActivity > 5 * 60 * 1000) {
      await deleteSession(userId, info.sessionId, kv);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Session check failed:', err);
    return false;
  }
}

export async function createSession(
  session: SessionInfo,
  kv: KVNamespace,
): Promise<void> {
  await Promise.all([
    kv.put(userKey(session.userId), JSON.stringify(session), { expirationTtl: SESSION_TTL }),
    kv.put(sessionKey(session.sessionId), JSON.stringify(session), { expirationTtl: SESSION_TTL }),
  ]);
}

export async function updateSessionActivity(
  session: SessionInfo,
  kv: KVNamespace,
): Promise<void> {
  const nextSession = { ...session, lastActivity: Date.now() };
  await createSession(nextSession, kv);
}

export async function deleteSession(
  userId: string,
  sessionId: string | null | undefined,
  kv: KVNamespace,
): Promise<void> {
  const ops: Promise<void>[] = [kv.delete(userKey(userId))];
  if (sessionId) ops.push(kv.delete(sessionKey(sessionId)));
  await Promise.all(ops);
}
