import { Hono } from 'hono';
import type { Env, PostStats, EditorPick } from '../types';
import { queryOne, queryAll, execute } from '../lib/d1';
import { success, error } from '../lib/response';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /api/v1/analytics/view
 * Record a view for a post
 */
app.post('/view', async (c) => {
  try {
    const body = await c.req.json<{ year: string; slug: string }>();
    const { year, slug } = body;

    if (!year || !slug) {
      return error(c, 'year and slug are required', 400);
    }

    const today = new Date().toISOString().split('T')[0];
    const db = c.env.DB;

    // Upsert daily view count
    await execute(
      db,
      `INSERT INTO post_views (post_slug, year, view_date, view_count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(post_slug, year, view_date)
       DO UPDATE SET view_count = view_count + 1, updated_at = datetime('now')`,
      slug,
      year,
      today
    );

    // Update aggregated stats
    const existingStats = await queryOne<PostStats>(
      db,
      `SELECT * FROM post_stats WHERE post_slug = ? AND year = ?`,
      slug,
      year
    );

    if (existingStats) {
      // Update existing stats
      await execute(
        db,
        `UPDATE post_stats
         SET total_views = total_views + 1,
             last_viewed_at = datetime('now'),
             updated_at = datetime('now')
         WHERE post_slug = ? AND year = ?`,
        slug,
        year
      );
    } else {
      // Create new stats record
      await execute(
        db,
        `INSERT INTO post_stats (post_slug, year, total_views, last_viewed_at)
         VALUES (?, ?, 1, datetime('now'))`,
        slug,
        year
      );
    }

    return success(c, { recorded: true });
  } catch (err) {
    console.error('Failed to record view:', err);
    return error(c, 'Failed to record view', 500);
  }
});

/**
 * GET /api/v1/analytics/stats/:year/:slug
 * Get stats for a specific post
 */
app.get('/stats/:year/:slug', async (c) => {
  try {
    const { year, slug } = c.req.param();
    const db = c.env.DB;

    const stats = await queryOne<PostStats>(
      db,
      `SELECT * FROM post_stats WHERE post_slug = ? AND year = ?`,
      slug,
      year
    );

    return success(c, {
      stats: stats || { total_views: 0, views_7d: 0, views_30d: 0 },
    });
  } catch (err) {
    console.error('Failed to get stats:', err);
    return error(c, 'Failed to get stats', 500);
  }
});

/**
 * GET /api/v1/analytics/editor-picks
 * Get active editor picks
 */
app.get('/editor-picks', async (c) => {
  try {
    const db = c.env.DB;
    const limit = parseInt(c.req.query('limit') || '3');

    const picks = await queryAll<EditorPick>(
      db,
      `SELECT * FROM editor_picks
       WHERE is_active = 1
         AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY rank ASC
       LIMIT ?`,
      limit
    );

    return success(c, { picks });
  } catch (err) {
    console.error('Failed to get editor picks:', err);
    return error(c, 'Failed to get editor picks', 500);
  }
});

/**
 * GET /api/v1/analytics/trending
 * Get trending posts based on recent views
 */
app.get('/trending', async (c) => {
  try {
    const db = c.env.DB;
    const limit = parseInt(c.req.query('limit') || '5');
    const days = parseInt(c.req.query('days') || '7');

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceDateStr = sinceDate.toISOString().split('T')[0];

    const trending = await queryAll<{
      post_slug: string;
      year: string;
      recent_views: number;
      total_views: number;
    }>(
      db,
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

    return success(c, { trending });
  } catch (err) {
    console.error('Failed to get trending:', err);
    return error(c, 'Failed to get trending', 500);
  }
});

/**
 * POST /api/v1/analytics/refresh-stats
 * Refresh 7d and 30d view counts (should be called by cron)
 */
app.post('/refresh-stats', async (c) => {
  try {
    const db = c.env.DB;

    const now = new Date();
    const date7d = new Date(now);
    date7d.setDate(date7d.getDate() - 7);
    const date30d = new Date(now);
    date30d.setDate(date30d.getDate() - 30);

    const date7dStr = date7d.toISOString().split('T')[0];
    const date30dStr = date30d.toISOString().split('T')[0];

    // Get all posts with views
    const allPosts = await queryAll<{ post_slug: string; year: string }>(
      db,
      `SELECT DISTINCT post_slug, year FROM post_stats`
    );

    for (const post of allPosts) {
      // Calculate 7d views
      const views7d = await queryOne<{ cnt: number }>(
        db,
        `SELECT COALESCE(SUM(view_count), 0) as cnt
         FROM post_views
         WHERE post_slug = ? AND year = ? AND view_date >= ?`,
        post.post_slug,
        post.year,
        date7dStr
      );

      // Calculate 30d views
      const views30d = await queryOne<{ cnt: number }>(
        db,
        `SELECT COALESCE(SUM(view_count), 0) as cnt
         FROM post_views
         WHERE post_slug = ? AND year = ? AND view_date >= ?`,
        post.post_slug,
        post.year,
        date30dStr
      );

      await execute(
        db,
        `UPDATE post_stats
         SET views_7d = ?, views_30d = ?, updated_at = datetime('now')
         WHERE post_slug = ? AND year = ?`,
        views7d?.cnt || 0,
        views30d?.cnt || 0,
        post.post_slug,
        post.year
      );
    }

    return success(c, { refreshed: allPosts.length });
  } catch (err) {
    console.error('Failed to refresh stats:', err);
    return error(c, 'Failed to refresh stats', 500);
  }
});

/**
 * POST /api/v1/analytics/update-editor-picks
 * Auto-update editor picks based on analytics (should be called by cron daily)
 */
app.post('/update-editor-picks', async (c) => {
  try {
    const db = c.env.DB;

    // Scoring algorithm:
    // - 50% weight on 7-day views (recency)
    // - 30% weight on 30-day views (sustained interest)
    // - 20% weight on total views (evergreen content)
    const topPosts = await queryAll<PostStats>(
      db,
      `SELECT *,
         (views_7d * 0.5 + views_30d * 0.3 + total_views * 0.2) as score
       FROM post_stats
       WHERE total_views > 0
       ORDER BY score DESC
       LIMIT 10`
    );

    if (topPosts.length === 0) {
      return success(c, { message: 'No posts with views found' });
    }

    // Deactivate all current picks
    await execute(db, `UPDATE editor_picks SET is_active = 0, updated_at = datetime('now')`);

    // Calculate tomorrow as expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);
    expiresAt.setHours(6, 0, 0, 0); // Expire at 6 AM next day
    const expiresAtStr = expiresAt.toISOString();

    // Insert/update top 3 picks
    const topPicks = topPosts.slice(0, 3);
    for (let i = 0; i < topPicks.length; i++) {
      const postItem = topPicks[i];
      if (!postItem) continue;
      const score =
        postItem.views_7d * 0.5 + postItem.views_30d * 0.3 + postItem.total_views * 0.2;

      // Determine reason
      let reason = 'Popular post';
      if (postItem.views_7d > postItem.views_30d * 0.5) {
        reason = 'Trending this week';
      } else if (postItem.total_views > 100) {
        reason = 'Evergreen favorite';
      }

      await execute(
        db,
        `INSERT INTO editor_picks (post_slug, year, title, rank, score, reason, expires_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(post_slug, year)
         DO UPDATE SET
           rank = ?,
           score = ?,
           reason = ?,
           expires_at = ?,
           is_active = 1,
           picked_at = datetime('now'),
           updated_at = datetime('now')`,
        postItem.post_slug,
        postItem.year,
        '', // title will be filled by frontend
        i + 1,
        score,
        reason,
        expiresAtStr,
        i + 1,
        score,
        reason,
        expiresAtStr
      );
    }

    return success(c, {
      updated: topPicks.length,
      picks: topPicks.map((p, i) => ({
        rank: i + 1,
        slug: p.post_slug,
        year: p.year,
        score: p.views_7d * 0.5 + p.views_30d * 0.3 + p.total_views * 0.2,
      })),
    });
  } catch (err) {
    console.error('Failed to update editor picks:', err);
    return error(c, 'Failed to update editor picks', 500);
  }
});

export default app;
