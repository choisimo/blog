import { getRedisClient, isRedisAvailable } from '../../lib/redis-client.js';
import { RATE_LIMIT } from '../../config/constants.js';

const RATE_LIMIT_PREFIX = 'ratelimit:';

export class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || RATE_LIMIT.WINDOW_MS;
    this.maxRequests = options.maxRequests || RATE_LIMIT.MAX;
    this.keyPrefix = options.keyPrefix || 'ai';
  }

  _getKey(identifier) {
    return `${RATE_LIMIT_PREFIX}${this.keyPrefix}:${identifier}`;
  }

  async isAllowed(identifier) {
    if (!await isRedisAvailable()) {
      return { allowed: true, remaining: this.maxRequests, resetAt: null };
    }

    const client = await getRedisClient();
    const key = this._getKey(identifier);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    await client.zRemRangeByScore(key, 0, windowStart);

    const count = await client.zCard(key);

    if (count >= this.maxRequests) {
      const oldestEntry = await client.zRange(key, 0, 0, { BY: 'SCORE' });
      const resetAt = oldestEntry.length > 0 
        ? parseInt(oldestEntry[0], 10) + this.windowMs 
        : now + this.windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      };
    }

    await client.zAdd(key, { score: now, value: String(now) });
    await client.expire(key, Math.ceil(this.windowMs / 1000) + 1);

    return {
      allowed: true,
      remaining: this.maxRequests - count - 1,
      resetAt: now + this.windowMs,
    };
  }

  async getRemainingQuota(identifier) {
    if (!await isRedisAvailable()) {
      return { remaining: this.maxRequests, total: this.maxRequests };
    }

    const client = await getRedisClient();
    const key = this._getKey(identifier);
    const windowStart = Date.now() - this.windowMs;

    await client.zRemRangeByScore(key, 0, windowStart);
    const count = await client.zCard(key);

    return {
      remaining: Math.max(0, this.maxRequests - count),
      total: this.maxRequests,
      used: count,
    };
  }

  async reset(identifier) {
    if (!await isRedisAvailable()) {
      return { reset: false };
    }

    const client = await getRedisClient();
    const key = this._getKey(identifier);
    await client.del(key);
    return { reset: true };
  }
}

let _aiRateLimiter = null;

export function getAIRateLimiter() {
  if (!_aiRateLimiter) {
    _aiRateLimiter = new RateLimiter({
      windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS, 10) || RATE_LIMIT.AI_WINDOW_MS,
      maxRequests: parseInt(process.env.AI_RATE_LIMIT_MAX, 10) || RATE_LIMIT.AI_MAX,
      keyPrefix: 'ai',
    });
  }
  return _aiRateLimiter;
}
