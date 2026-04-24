/**
 * Terminal Gateway - Rate Limiting
 *
 * Single-session ownership is enforced by terminal-server, where Redis Lua
 * scripts can claim/release the user mapping atomically. The gateway keeps only
 * the IP rate limiter here; Cloudflare KV is not used as an authoritative
 * session lock because KV read/write pairs are not atomic.
 */

import type { RateLimitResult } from './types';

const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const RATE_LIMIT_MAX = 5; // max connections per window

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
