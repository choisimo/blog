/**
 * Terminal Gateway - Rate Limiting
 * 
 * Uses KV to track connection attempts per IP
 * Limits: 5 connections per minute
 */

import type { RateLimitResult } from './types';

const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const RATE_LIMIT_MAX = 5; // max connections per window

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
        reason: 'limit_exceeded',
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
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + RATE_LIMIT_WINDOW,
      reason: 'kv_unavailable',
    };
  }
}
