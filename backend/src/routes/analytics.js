import { Router } from 'express';
import { queryAll, queryOne, execute, isD1Configured } from '../lib/d1.js';
import {
  recordVisit,
  getTrendingPosts,
  getPostStats,
  getAllPostStats,
  refreshPeriodicStats,
  isPgConfigured,
} from '../repositories/analytics.repository.js';
import { httpCache, invalidateCacheByPrefix } from '../middleware/httpCache.js';
import { createLogger } from '../lib/logger.js';

const router = Router();
const logger = createLogger('analytics');

const requirePg = (req, res, next) => {
  if (!isPgConfigured()) {
    return res.status(503).json({ ok: false, error: 'Analytics service not configured (DATABASE_URL missing)' });
  }
  next();
};

const requireD1 = (req, res, next) => {
  if (!isD1Configured()) {
    return res.status(503).json({ ok: false, error: 'Editor picks not configured (D1 credentials missing)' });
  }
  next();
};

router.post('/view', requirePg, async (req, res, next) => {
  try {
    const { year, slug } = req.body || {};
    if (!year || !slug) {
      return res.status(400).json({ ok: false, error: 'year and slug are required' });
    }

    const ip = req.headers['cf-connecting-ip']
      || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.ip
      || null;
    const userAgent = req.headers['user-agent'] || null;
    const referer = req.headers['referer'] || req.headers['referrer'] || null;
    const path = req.body.path || null;
    const sessionId = req.body.sessionId || null;

    await recordVisit({ slug, year, ip, userAgent, referer, path, sessionId });
    return res.json({ ok: true, data: { recorded: true } });
  } catch (err) {
    logger.error({}, 'Failed to record view', { error: err.message });
    return next(err);
  }
});

router.get('/stats/:year/:slug', requirePg, async (req, res, next) => {
  try {
    const { year, slug } = req.params;
    const stats = await getPostStats(slug, year);
    return res.json({
      ok: true,
      data: { stats: stats || { total_views: 0, views_7d: 0, views_30d: 0 } },
    });
  } catch (err) {
    logger.error({}, 'Failed to get stats', { error: err.message });
    return next(err);
  }
});

router.get('/all-stats', requirePg, getAllPostStatsHandler);

export async function getAllPostStatsHandler(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
    const offset = parseInt(req.query.offset) || 0;
    const orderBy = req.query.orderBy || 'total_views';
    const stats = await getAllPostStats({ limit, offset, orderBy });
    return res.json({ ok: true, data: { stats, total: stats.length } });
  } catch (err) {
    next(err);
  }
}

router.get('/editor-picks', requireD1, httpCache({ ttl: 600, prefix: 'analytics' }), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 3;
    const picks = await queryAll(
      `SELECT * FROM editor_picks
       WHERE is_active = 1
         AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY rank ASC
       LIMIT ?`,
      limit
    );
    return res.json({ ok: true, data: { picks } });
  } catch (err) {
    logger.error({}, 'Failed to get editor picks', { error: err.message });
    return next(err);
  }
});

router.get('/trending', requirePg, httpCache({ ttl: 300, prefix: 'analytics' }), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const days = parseInt(req.query.days) || 7;
    const trending = await getTrendingPosts({ days, limit });
    return res.json({ ok: true, data: { trending } });
  } catch (err) {
    logger.error({}, 'Failed to get trending', { error: err.message });
    return next(err);
  }
});

router.post('/refresh-stats', requirePg, async (req, res, next) => {
  try {
    const refreshed = await refreshPeriodicStats();
    await invalidateCacheByPrefix('analytics');
    return res.json({ ok: true, data: { refreshed } });
  } catch (err) {
    logger.error({}, 'Failed to refresh stats', { error: err.message });
    return next(err);
  }
});

export default router;
