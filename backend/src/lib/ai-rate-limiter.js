import { getRedisClient, isRedisAvailable } from './redis-client.js';

const RATE_LIMIT_PREFIX = 'ratelimit:';

export class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 60;
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
      windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS, 10) || 60000,
      maxRequests: parseInt(process.env.AI_RATE_LIMIT_MAX, 10) || 30,
      keyPrefix: 'ai',
    });
  }
  return _aiRateLimiter;
}

export function rateLimitMiddleware(options = {}) {
  const limiter = options.limiter || getAIRateLimiter();
  const getIdentifier = options.getIdentifier || ((req) => {
    return req.ip || req.headers['x-forwarded-for'] || 'anonymous';
  });

  return async (req, res, next) => {
    const identifier = getIdentifier(req);
    const result = await limiter.isAllowed(identifier);

    res.set('X-RateLimit-Limit', String(limiter.maxRequests));
    res.set('X-RateLimit-Remaining', String(result.remaining));

    if (result.resetAt) {
      res.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
    }

    if (!result.allowed) {
      res.set('Retry-After', String(result.retryAfter));
      return res.status(429).json({
        ok: false,
        error: {
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: result.retryAfter,
        },
      });
    }

    next();
  };
}
