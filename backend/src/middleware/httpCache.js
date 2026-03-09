import { getRedisClient, isRedisAvailable } from '../lib/redis-client.js';

const CACHE_KEY_NS = 'http_cache';

function buildCacheKey(req, { prefix, keyFromBody }) {
  const parts = [CACHE_KEY_NS, prefix];

  parts.push(req.path.replace(/^\//, '').replace(/\//g, ':') || '_root');

  const qs = req.query || {};
  const qsKeys = Object.keys(qs).sort();
  if (qsKeys.length > 0) {
    parts.push(qsKeys.map(k => `${k}=${qs[k]}`).join('&'));
  }

  if (keyFromBody && keyFromBody.length > 0 && req.body) {
    const bodyParts = keyFromBody
      .map(k => {
        const v = req.body[k];
        return v !== undefined && v !== null ? `${k}=${String(v)}` : null;
      })
      .filter(Boolean);
    if (bodyParts.length > 0) {
      parts.push(bodyParts.join('&'));
    }
  }

  return parts.join(':');
}

/**
 * Express middleware factory for Redis HTTP response caching.
 *
 * @param {object} options
 * @param {number} [options.ttl=300]          - Cache TTL in seconds
 * @param {string} [options.prefix='route']   - Cache key namespace
 * @param {string[]} [options.keyFromBody]    - POST body fields to include in cache key
 * @param {boolean} [options.allowPost=false] - Cache POST requests
 * @returns {import('express').RequestHandler}
 */
export function httpCache(options = {}) {
  const {
    ttl = 300,
    prefix = 'route',
    keyFromBody = [],
    allowPost = false,
  } = options;

  return async (req, res, next) => {
    const method = req.method;

    if (method !== 'GET' && !(method === 'POST' && allowPost)) {
      res.set('X-Cache-Status', 'BYPASS');
      return next();
    }

    const cacheKey = buildCacheKey(req, { prefix, keyFromBody });

    try {
      if (await isRedisAvailable()) {
        const client = await getRedisClient();
        const cached = await client.get(cacheKey);

        if (cached) {
          let parsed;
          try {
            parsed = JSON.parse(cached);
          } catch {
            await client.del(cacheKey).catch(() => {});
          }

          if (parsed) {
            res.set('X-Cache-Status', 'HIT');
            res.set('X-Cache-Key', cacheKey);
            if (parsed.headers) {
              const ct = parsed.headers['content-type'];
              if (ct) res.set('Content-Type', ct);
            }
            return res.json(parsed.body);
          }
        }
      }
    } catch (err) {
      console.error('[httpCache] Redis read error:', err.message);
      res.set('X-Cache-Status', 'ERROR');
    }

    res.set('X-Cache-Status', 'MISS');
    res.set('X-Cache-Key', cacheKey);

    const originalJson = res.json.bind(res);

    res.json = function (body) {
      const statusCode = res.statusCode;
      if (statusCode >= 200 && statusCode < 300) {
        const payload = JSON.stringify({
          body,
          headers: { 'content-type': 'application/json' },
          cachedAt: Date.now(),
        });

        isRedisAvailable()
          .then(available => {
            if (!available) return;
            return getRedisClient().then(client =>
              client.set(cacheKey, payload, { EX: ttl })
            );
          })
          .catch(err => {
            console.error('[httpCache] Redis write error:', err.message);
          });
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate cache keys matching a Redis glob pattern.
 * Uses SCAN instead of KEYS to avoid blocking Redis on large keyspaces.
 *
 * @param {string} pattern - e.g. 'http_cache:posts:*'
 * @returns {Promise<number>} number of deleted keys
 */
export async function invalidateCache(pattern) {
  try {
    if (!(await isRedisAvailable())) return 0;
    const client = await getRedisClient();

    let cursor = 0;
    let deleted = 0;

    do {
      const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      const keys = reply.keys;

      if (keys.length > 0) {
        await client.del(keys);
        deleted += keys.length;
      }
    } while (cursor !== 0);

    if (deleted > 0) {
      console.log(`[httpCache] Invalidated ${deleted} cache key(s) matching: ${pattern}`);
    }

    return deleted;
  } catch (err) {
    console.error('[httpCache] Invalidation error:', err.message);
    return 0;
  }
}

export async function invalidateCacheByPrefix(prefix) {
  return invalidateCache(`${CACHE_KEY_NS}:${prefix}:*`);
}
