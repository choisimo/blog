import { Router } from 'express';
import { queryAll, queryOne, execute, isD1Configured } from '../lib/d1.js';

const router = Router();

// Middleware to check D1 configuration
const requireD1 = (req, res, next) => {
  if (!isD1Configured()) {
    return res.status(503).json({
      ok: false,
      error: 'Analytics service not configured (D1 credentials missing)',
    });
  }
  next();
};

/**
 * POST /api/v1/analytics/view
 * Record a view for a post
 */
router.post('/view', requireD1, async (req, res, next) => {
  try {
    const { year, slug } = req.body || {};

    if (!year || !slug) {
      return res.status(400).json({ ok: false, error: 'year and slug are required' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Upsert daily view count
    await execute(
      `INSERT INTO post_views (post_slug, year, view_date, view_count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(post_slug, year, view_date)
       DO UPDATE SET view_count = view_count + 1, updated_at = datetime('now')`,
      slug,
      year,
      today
    );

    // Update aggregated stats
    const existingStats = await queryOne(
      `SELECT * FROM post_stats WHERE post_slug = ? AND year = ?`,
      slug,
      year
    );

    if (existingStats) {
      await execute(
        `UPDATE post_stats
         SET total_views = total_views + 1,
             last_viewed_at = datetime('now'),
             updated_at = datetime('now')
         WHERE post_slug = ? AND year = ?`,
        slug,
        year
      );
    } else {
      await execute(
        `INSERT INTO post_stats (post_slug, year, total_views, last_viewed_at)
         VALUES (?, ?, 1, datetime('now'))`,
        slug,
        year
      );
    }

    return res.json({ ok: true, data: { recorded: true } });
  } catch (err) {
    console.error('Failed to record view:', err);
    return next(err);
  }
});

/**
 * GET /api/v1/analytics/stats/:year/:slug
 * Get stats for a specific post
 */
router.get('/stats/:year/:slug', requireD1, async (req, res, next) => {
  try {
    const { year, slug } = req.params;

    const stats = await queryOne(
      `SELECT * FROM post_stats WHERE post_slug = ? AND year = ?`,
      slug,
      year
    );

    return res.json({
      ok: true,
      data: {
        stats: stats || { total_views: 0, views_7d: 0, views_30d: 0 },
      },
    });
  } catch (err) {
    console.error('Failed to get stats:', err);
    return next(err);
  }
});

/**
 * GET /api/v1/analytics/editor-picks
 * Get active editor picks
 */
router.get('/editor-picks', requireD1, async (req, res, next) => {
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
    console.error('Failed to get editor picks:', err);
    return next(err);
  }
});

/**
 * GET /api/v1/analytics/trending
 * Get trending posts based on recent views
 */
router.get('/trending', requireD1, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const days = parseInt(req.query.days) || 7;

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceDateStr = sinceDate.toISOString().split('T')[0];

    const trending = await queryAll(
      `SELECT
         pv.post_slug,
         pv.year,
         SUM(pv.view_count) as recent_views,
         COALESCE(ps.total_views, 0) as total_views
       FROM post_views pv
       LEFT JOIN post_stats ps ON pv.post_slug = ps.post_slug AND pv.year = ps.year
       WHERE pv.view_date >= ?
       GROUP BY pv.post_slug, pv.year
       ORDER BY recent_views DESC
       LIMIT ?`,
      sinceDateStr,
      limit
    );

    return res.json({ ok: true, data: { trending } });
  } catch (err) {
    console.error('Failed to get trending:', err);
    return next(err);
  }
});

/**
 * POST /api/v1/analytics/refresh-stats
 * Refresh 7d and 30d view counts (admin/cron)
 */
router.post('/refresh-stats', requireD1, async (req, res, next) => {
  try {
    const now = new Date();
    const date7d = new Date(now);
    date7d.setDate(date7d.getDate() - 7);
    const date30d = new Date(now);
    date30d.setDate(date30d.getDate() - 30);

    const date7dStr = date7d.toISOString().split('T')[0];
    const date30dStr = date30d.toISOString().split('T')[0];

    const allPosts = await queryAll(
      `SELECT DISTINCT post_slug, year FROM post_stats`
    );

    for (const post of allPosts) {
      const views7d = await queryOne(
        `SELECT COALESCE(SUM(view_count), 0) as cnt
         FROM post_views
         WHERE post_slug = ? AND year = ? AND view_date >= ?`,
        post.post_slug,
        post.year,
        date7dStr
      );

      const views30d = await queryOne(
        `SELECT COALESCE(SUM(view_count), 0) as cnt
         FROM post_views
         WHERE post_slug = ? AND year = ? AND view_date >= ?`,
        post.post_slug,
        post.year,
        date30dStr
      );

      await execute(
        `UPDATE post_stats
         SET views_7d = ?, views_30d = ?, updated_at = datetime('now')
         WHERE post_slug = ? AND year = ?`,
        views7d?.cnt || 0,
        views30d?.cnt || 0,
        post.post_slug,
        post.year
      );
    }

    return res.json({ ok: true, data: { refreshed: allPosts.length } });
  } catch (err) {
    console.error('Failed to refresh stats:', err);
    return next(err);
  }
});

export default router;
