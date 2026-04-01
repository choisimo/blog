/**
 * Terminal Gateway - Rate Limiting
 * 
 * Uses KV to track connection attempts per IP
 * Limits: 5 connections per minute, 1 concurrent session per user
 */

import type { Env, RateLimitResult, SessionInfo } from './types';

const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const RATE_LIMIT_MAX = 5; // max connections per window
const SESSION_TTL = 15 * 60; // 15 minutes session TTL

/**
 * Check rate limit for an IP address
 */
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
      // Check if we're still in the same window
      if (now - parsed.windowStart < RATE_LIMIT_WINDOW) {
        count = parsed.count;
        windowStart = parsed.windowStart;
      }
    }

    // Check if limit exceeded
    if (count >= RATE_LIMIT_MAX) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowStart + RATE_LIMIT_WINDOW,
      };
    }

    // Increment counter
    count++;
    await kv.put(
      key,
      JSON.stringify({ count, windowStart }),
      { expirationTtl: RATE_LIMIT_WINDOW }
    );

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - count,
      resetAt: windowStart + RATE_LIMIT_WINDOW,
    };
  } catch (err) {
    console.error('Rate limit check failed:', err);
    // Allow on error (fail open)
    return { allowed: true, remaining: 1, resetAt: now + RATE_LIMIT_WINDOW };
  }
}

/**
 * Check if user already has an active session
 */
export async function hasActiveSession(
  userId: string,
  kv: KVNamespace
): Promise<boolean> {
  const key = `session:${userId}`;
  try {
    const session = await kv.get(key);
    if (!session) {
      return false;
    }

    const info = JSON.parse(session) as SessionInfo;
    const now = Date.now();

    // Check if session is still valid (activity within last 5 minutes)
    if (now - info.lastActivity > 5 * 60 * 1000) {
      // Session expired, clean up
      await kv.delete(key);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Session check failed:', err);
    return false;
  }
}

/**
 * Create a new session for user
 */
export async function createSession(
  userId: string,
  clientIP: string,
  kv: KVNamespace
): Promise<void> {
  const key = `session:${userId}`;
  const session: SessionInfo = {
    userId,
    clientIP,
    connectedAt: Date.now(),
    lastActivity: Date.now(),
  };

  await kv.put(key, JSON.stringify(session), { expirationTtl: SESSION_TTL });
}

/**
 * Update session activity timestamp
 */
export async function updateSessionActivity(
  userId: string,
  kv: KVNamespace
): Promise<void> {
  const key = `session:${userId}`;
  try {
    const data = await kv.get(key);
    if (data) {
      const session = JSON.parse(data) as SessionInfo;
      session.lastActivity = Date.now();
      await kv.put(key, JSON.stringify(session), { expirationTtl: SESSION_TTL });
    }
  } catch (err) {
    console.error('Session update failed:', err);
  }
}

/**
 * Delete user session
 */
export async function deleteSession(
  userId: string,
  kv: KVNamespace
): Promise<void> {
  const key = `session:${userId}`;
  await kv.delete(key);
}
