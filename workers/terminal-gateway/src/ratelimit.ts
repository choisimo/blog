/**
 * Terminal Gateway - Rate Limiting and Session Tracking
 */

import type { RateLimitResult, SessionInfo } from './types';

const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const RATE_LIMIT_MAX = 5; // max connections per window
const SESSION_TTL_SECONDS = 15 * 60;
const SESSION_STALE_MS = 5 * 60 * 1000;

function sessionKey(sessionId: string): string {
  return `terminal:session:${sessionId}`;
}

function userKey(userId: string): string {
  return `terminal:user:${userId}`;
}

export async function checkRateLimit(
  clientIP: string,
  kv: KVNamespace
): Promise<RateLimitResult> {
  const key = `ratelimit:${clientIP}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    const data = await kv.get(key);
    let count = 0;
    let windowStart = now;

    if (data) {
      const parsed = JSON.parse(data);
      if (now - parsed.windowStart < RATE_LIMIT_WINDOW) {
        count = parsed.count;
        windowStart = parsed.windowStart;
      }
    }

    if (count >= RATE_LIMIT_MAX) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowStart + RATE_LIMIT_WINDOW,
        reason: 'limit_exceeded',
      };
    }

    count++;
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
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + RATE_LIMIT_WINDOW,
      reason: 'kv_unavailable',
    };
  }
}

export async function hasActiveSession(
  userId: string,
  kv: KVNamespace
): Promise<boolean> {
  try {
    const raw = await kv.get(userKey(userId));
    if (!raw) {
      return false;
    }

    const info = JSON.parse(raw) as SessionInfo;
    if (Date.now() - info.lastActivity > SESSION_STALE_MS) {
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
  ttlSeconds: number = SESSION_TTL_SECONDS
): Promise<void> {
  await Promise.all([
    kv.put(userKey(session.userId), JSON.stringify(session), {
      expirationTtl: ttlSeconds,
    }),
    kv.put(sessionKey(session.sessionId), JSON.stringify(session), {
      expirationTtl: ttlSeconds,
    }),
  ]);
}

export async function deleteSession(
  userId: string,
  sessionId: string | null | undefined,
  kv: KVNamespace
): Promise<void> {
  const ops: Promise<void>[] = [kv.delete(userKey(userId))];
  if (sessionId) {
    ops.push(kv.delete(sessionKey(sessionId)));
  }
  await Promise.all(ops);
}
