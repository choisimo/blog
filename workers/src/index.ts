import { Hono } from 'hono';
import type { Env } from './types';
import { corsMiddleware } from './middleware/cors';
import { loggerMiddleware } from './middleware/logger';
import { errorHandler } from './middleware/error';
import { success } from './lib/response';

// Import routes
import auth from './routes/auth';
import posts from './routes/posts';
import comments from './routes/comments';
import ai from './routes/ai';
import chat from './routes/chat';
import images from './routes/images';
import og from './routes/og';
import analytics from './routes/analytics';
import translate from './routes/translate';
import config from './routes/config';
import rag from './routes/rag';
import gateway from './routes/gateway';
import memos from './routes/memos';

const app = new Hono<{ Bindings: Env }>();

// Global middlewares
app.use('*', corsMiddleware);
app.use('*', loggerMiddleware);

// Health check
app.get('/healthz', (c) => {
  return success(c, {
    status: 'ok',
    env: c.env.ENV,
    timestamp: new Date().toISOString(),
  });
});

// Public config
app.get('/public/config', (c) => {
  return success(c, {
    env: c.env.ENV,
    features: {
      aiInline: true,
      comments: true,
    },
  });
});

// Mount API routes under /api/v1
const api = new Hono<{ Bindings: Env }>();
api.route('/auth', auth);
api.route('/posts', posts);
api.route('/comments', comments);
api.route('/ai', ai);
api.route('/chat', chat);
api.route('/images', images);
api.route('/og', og);
api.route('/analytics', analytics);
api.route('/translate', translate);
api.route('/config', config);
api.route('/rag', rag);
api.route('/gateway', gateway);
api.route('/memos', memos);

app.route('/api/v1', api);

// 404 handler
app.notFound((c) => {
  return c.json({ ok: false, error: { message: 'Not Found' } }, 404);
});

// Error handler
app.onError(errorHandler);

// Scheduled handler for cron triggers
async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  console.log(`Cron triggered at ${new Date().toISOString()}`);

  try {
    const db = env.DB;

    // 1. Refresh post stats (7d, 30d views)
    const now = new Date();
    const date7d = new Date(now);
    date7d.setDate(date7d.getDate() - 7);
    const date30d = new Date(now);
    date30d.setDate(date30d.getDate() - 30);
    const date7dStr = date7d.toISOString().split('T')[0];
    const date30dStr = date30d.toISOString().split('T')[0];

    const allPosts = await db
      .prepare(`SELECT DISTINCT post_slug, year FROM post_stats`)
      .all<{ post_slug: string; year: string }>();

    for (const post of allPosts.results || []) {
      const views7d = await db
        .prepare(
          `SELECT COALESCE(SUM(view_count), 0) as cnt FROM post_views WHERE post_slug = ? AND year = ? AND view_date >= ?`
        )
        .bind(post.post_slug, post.year, date7dStr)
        .first<{ cnt: number }>();

      const views30d = await db
        .prepare(
          `SELECT COALESCE(SUM(view_count), 0) as cnt FROM post_views WHERE post_slug = ? AND year = ? AND view_date >= ?`
        )
        .bind(post.post_slug, post.year, date30dStr)
        .first<{ cnt: number }>();

      await db
        .prepare(
          `UPDATE post_stats SET views_7d = ?, views_30d = ?, updated_at = datetime('now') WHERE post_slug = ? AND year = ?`
        )
        .bind(views7d?.cnt || 0, views30d?.cnt || 0, post.post_slug, post.year)
        .run();
    }

    console.log(`Refreshed stats for ${allPosts.results?.length || 0} posts`);

    // 2. Update editor picks
    const topPosts = await db
      .prepare(
        `SELECT *, (views_7d * 0.5 + views_30d * 0.3 + total_views * 0.2) as score
         FROM post_stats WHERE total_views > 0 ORDER BY score DESC LIMIT 10`
      )
      .all<{ post_slug: string; year: string; views_7d: number; views_30d: number; total_views: number }>();

    if (topPosts.results && topPosts.results.length > 0) {
      // Deactivate all current picks
      await db.prepare(`UPDATE editor_picks SET is_active = 0, updated_at = datetime('now')`).run();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);
      expiresAt.setHours(6, 0, 0, 0);
      const expiresAtStr = expiresAt.toISOString();

      const topPicks = topPosts.results.slice(0, 3);
      for (let i = 0; i < topPicks.length; i++) {
        const postItem = topPicks[i];
        if (!postItem) continue;
        const score = postItem.views_7d * 0.5 + postItem.views_30d * 0.3 + postItem.total_views * 0.2;
        let reason = 'Popular post';
        if (postItem.views_7d > postItem.views_30d * 0.5) {
          reason = 'Trending this week';
        } else if (postItem.total_views > 100) {
          reason = 'Evergreen favorite';
        }

        await db
          .prepare(
            `INSERT INTO editor_picks (post_slug, year, title, rank, score, reason, expires_at, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)
             ON CONFLICT(post_slug, year)
             DO UPDATE SET rank = ?, score = ?, reason = ?, expires_at = ?, is_active = 1, picked_at = datetime('now'), updated_at = datetime('now')`
          )
          .bind(postItem.post_slug, postItem.year, '', i + 1, score, reason, expiresAtStr, i + 1, score, reason, expiresAtStr)
          .run();
      }

      console.log(`Updated ${topPicks.length} editor picks`);
    }

    // 3. Clean up old view records (older than 90 days)
    const date90d = new Date(now);
    date90d.setDate(date90d.getDate() - 90);
    const date90dStr = date90d.toISOString().split('T')[0];

    await db.prepare(`DELETE FROM post_views WHERE view_date < ?`).bind(date90dStr).run();

    console.log('Cron job completed successfully');
  } catch (err) {
    console.error('Cron job failed:', err);
  }
}

export default {
  fetch: app.fetch,
  scheduled,
};
