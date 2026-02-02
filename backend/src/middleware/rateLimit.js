import { getAIRateLimiter } from '../services/ai/rate-limiter.service.js';

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
