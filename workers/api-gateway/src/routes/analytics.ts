import { Hono } from 'hono';
import type { HonoEnv, Env, PostStats, EditorPick } from '../types';
import { queryOne, queryAll, execute } from '../lib/d1';
import { success, error, badRequest, notFound } from '../lib/response';
import { requireAdmin } from '../middleware/auth';
import { buildDataOwnershipHeaders } from '../../../../shared/src/contracts/data-ownership.js';

// ---------------------------------------------------------------------------
// Backend proxy helper
// IMPORTANT: Use BACKEND_ORIGIN directly, NOT getApiBaseUrl() — that resolves
// to api.example.com (this worker itself) and would cause an infinite loop.
// ---------------------------------------------------------------------------
async function proxyToBackend(
  env: Env,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  query?: string
): Promise<{ ok: boolean; data?: unknown; error?: string; status: number }> {
  const backendOrigin = env.BACKEND_ORIGIN;
  if (!backendOrigin) {
    return { ok: false, error: 'BACKEND_ORIGIN not configured', status: 500 };
  }

  const url = `${backendOrigin}/api/v1/analytics${path}${query ? `?${query}` : ''}`;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (env.BACKEND_KEY) {
    headers['X-Backend-Key'] = env.BACKEND_KEY;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => null);
    return { ok: response.ok, data: json, status: response.status };
  } catch (err) {
    console.error(`Backend proxy error [${method} ${path}]:`, err);
    return { ok: false, error: 'Backend unavailable', status: 503 };
  }
}

const app = new Hono<HonoEnv>();

function applyDataOwnership(c: any, ownershipId: string) {
  const headers = buildDataOwnershipHeaders(ownershipId);
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value);
  }
}

/**
 * POST /api/v1/analytics/view
 * Record a view for a post.
 * Ownership: Backend (Postgres) — this handler is a thin proxy.
 */
app.post('/view', async (c) => {
  try {
    applyDataOwnership(c, 'analytics.post_stats');
    const body = await c.req.json<{ year: string; slug: string }>().catch(() => ({}) as { year: string; slug: string });
    if (!body.year || !body.slug) {
      return error(c, 'year and slug are required', 400);
    }

    const result = await proxyToBackend(c.env, '/view', 'POST', body);
    if (!result.ok) {
      console.error('Backend view proxy failed:', result.error || result.status);
      return error(c, result.error || 'Failed to record view', result.status as 400 | 500 | 503);
    }

    return success(c, { recorded: true });
  } catch (err) {
    console.error('Failed to record view:', err);
    return error(c, 'Failed to record view', 500);
  }
});

/**
 * GET /api/v1/analytics/stats/:year/:slug
 * Get stats for a specific post.
 * Ownership: Backend (Postgres) — this handler is a thin proxy.
 */
app.get('/stats/:year/:slug', async (c) => {
  try {
    applyDataOwnership(c, 'analytics.post_stats');
    const { year, slug } = c.req.param();

    const result = await proxyToBackend(c.env, `/stats/${year}/${slug}`, 'GET');
    if (!result.ok) {
      // Graceful fallback: return zero stats rather than erroring
      console.warn('Backend stats proxy failed, returning zero stats:', result.error || result.status);
      return success(c, {
        stats: { total_views: 0, views_7d: 0, views_30d: 0 },
      });
    }

    const payload = result.data as { ok?: boolean; data?: { stats?: PostStats } } | null;
    return success(c, {
      stats: payload?.data?.stats || { total_views: 0, views_7d: 0, views_30d: 0 },
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
    applyDataOwnership(c, 'analytics.editor_picks');
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
 * Get trending posts based on recent views.
 * Ownership: Backend (Postgres) — this handler is a thin proxy.
 */
app.get('/trending', async (c) => {
  try {
    applyDataOwnership(c, 'analytics.post_stats');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);
    const days = parseInt(c.req.query('days') || '7');

    const query = `limit=${limit}&offset=${offset}&days=${days}`;
    const result = await proxyToBackend(c.env, '/trending', 'GET', undefined, query);
    if (!result.ok) {
      console.warn('Backend trending proxy failed:', result.error || result.status);
      return success(c, { trending: [], total: 0, limit, offset });
    }

    const payload = result.data as { ok?: boolean; data?: { trending?: unknown[]; total?: number } } | null;
    return success(c, {
      trending: payload?.data?.trending || [],
      total: payload?.data?.total ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Failed to get trending:', err);
    return error(c, 'Failed to get trending', 500);
  }
});

/**
 * POST /api/v1/analytics/refresh-stats
 * Refresh 7d and 30d view counts.
 * Ownership: Backend (Postgres) — this handler is a thin proxy.
 */
app.post('/refresh-stats', requireAdmin, async (c) => {
  try {
    applyDataOwnership(c, 'analytics.post_stats');
    const result = await proxyToBackend(c.env, '/refresh-stats', 'POST');
    if (!result.ok) {
      return error(c, result.error || 'Failed to refresh stats', result.status as 500 | 503);
    }
    const payload = result.data as { ok?: boolean; data?: { refreshed?: number } } | null;
    return success(c, { refreshed: payload?.data?.refreshed ?? 0 });
  } catch (err) {
    console.error('Failed to refresh stats:', err);
    return error(c, 'Failed to refresh stats', 500);
  }
});

/**
 * POST /api/v1/analytics/update-editor-picks
 * Auto-update editor picks based on analytics (cron daily).
 * Reads top stats from Backend (Postgres) and writes editor_picks cache to D1.
 */
app.post('/update-editor-picks', requireAdmin, async (c) => {
  try {
    const db = c.env.DB;

    // Fetch top posts stats from Backend (Postgres is the canonical source)
    const statsResult = await proxyToBackend(
      c.env,
      '/all-stats',
      'GET',
      undefined,
      'limit=10&orderBy=total_views'
    );
    if (!statsResult.ok) {
      console.error('Failed to fetch all-stats from backend:', statsResult.error || statsResult.status);
      return error(c, 'Failed to fetch stats from backend', statsResult.status as 500 | 503);
    }

    type StatRow = {
      post_slug: string;
      year: string;
      total_views: number;
      views_7d: number;
      views_30d: number;
    };
    const statsPayload = statsResult.data as {
      ok?: boolean;
      data?: { stats?: StatRow[] };
    } | null;
    const allStats: StatRow[] = statsPayload?.data?.stats || [];

    // Score: 50% 7d + 30% 30d + 20% total
    const scored = allStats
      .filter((s) => s.total_views > 0)
      .map((s) => ({
        ...s,
        score: s.views_7d * 0.5 + s.views_30d * 0.3 + s.total_views * 0.2,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (scored.length === 0) {
      return success(c, { message: 'No posts with views found' });
    }

    // Deactivate all current picks in D1 cache
    await execute(db, `UPDATE editor_picks SET is_active = 0, updated_at = datetime('now')`);;

    // Calculate expiry (6 AM next day)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);
    expiresAt.setHours(6, 0, 0, 0);
    const expiresAtStr = expiresAt.toISOString();

    const topPicks = scored.slice(0, 3);
    for (let i = 0; i < topPicks.length; i++) {
      const postItem = topPicks[i];
      if (!postItem) continue;

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
        '', // title filled by frontend
        i + 1,
        postItem.score,
        reason,
        expiresAtStr,
        i + 1,
        postItem.score,
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
        score: p.score,
      })),
    });
  } catch (err) {
    console.error('Failed to update editor picks:', err);
    return error(c, 'Failed to update editor picks', 500);
  }
});

app.post('/admin/editor-picks', requireAdmin, async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json<{
      post_slug: string;
      year: string;
      title?: string;
      rank?: number;
      reason?: string;
      expires_at?: string | null;
    }>();

    if (!body.post_slug || !body.year) {
      return badRequest(c, 'post_slug and year are required');
    }

    const rank = body.rank ?? 99;
    const title = body.title ?? '';
    const reason = body.reason ?? 'Manually selected';
    const expiresAt = body.expires_at ?? null;

    await execute(
      db,
      `INSERT INTO editor_picks (post_slug, year, title, rank, score, reason, expires_at, is_active, picked_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, 1, datetime('now'))
       ON CONFLICT(post_slug, year)
       DO UPDATE SET
         title = ?,
         rank = ?,
         reason = ?,
         expires_at = ?,
         is_active = 1,
         updated_at = datetime('now')`,
      body.post_slug,
      body.year,
      title,
      rank,
      reason,
      expiresAt,
      title,
      rank,
      reason,
      expiresAt
    );

    const pick = await queryOne<EditorPick>(
      db,
      `SELECT * FROM editor_picks WHERE post_slug = ? AND year = ?`,
      body.post_slug,
      body.year
    );

    return success(c, { pick });
  } catch (err) {
    console.error('Failed to create editor pick:', err);
    return error(c, 'Failed to create editor pick', 500);
  }
});

app.put('/admin/editor-picks/:year/:slug', requireAdmin, async (c) => {
  try {
    const db = c.env.DB;
    const { year, slug } = c.req.param();
    const body = await c.req.json<{
      title?: string;
      rank?: number;
      reason?: string;
      is_active?: number;
      expires_at?: string | null;
    }>();

    const existing = await queryOne<EditorPick>(
      db,
      `SELECT * FROM editor_picks WHERE post_slug = ? AND year = ?`,
      slug,
      year
    );

    if (!existing) {
      return notFound(c, 'Editor pick not found');
    }

    const newTitle = body.title ?? existing.title;
    const newRank = body.rank ?? existing.rank;
    const newReason = body.reason ?? existing.reason;
    const newIsActive = body.is_active ?? existing.is_active;
    const newExpiresAt =
      'expires_at' in body ? body.expires_at : existing.expires_at;

    await execute(
      db,
      `UPDATE editor_picks
       SET title = ?, rank = ?, reason = ?, is_active = ?, expires_at = ?, updated_at = datetime('now')
       WHERE post_slug = ? AND year = ?`,
      newTitle,
      newRank,
      newReason,
      newIsActive,
      newExpiresAt,
      slug,
      year
    );

    const pick = await queryOne<EditorPick>(
      db,
      `SELECT * FROM editor_picks WHERE post_slug = ? AND year = ?`,
      slug,
      year
    );

    return success(c, { pick });
  } catch (err) {
    console.error('Failed to update editor pick:', err);
    return error(c, 'Failed to update editor pick', 500);
  }
});

app.delete('/admin/editor-picks/:year/:slug', requireAdmin, async (c) => {
  try {
    const db = c.env.DB;
    const { year, slug } = c.req.param();

    const existing = await queryOne<EditorPick>(
      db,
      `SELECT id FROM editor_picks WHERE post_slug = ? AND year = ?`,
      slug,
      year
    );

    if (!existing) {
      return notFound(c, 'Editor pick not found');
    }

    await execute(
      db,
      `UPDATE editor_picks SET is_active = 0, updated_at = datetime('now') WHERE post_slug = ? AND year = ?`,
      slug,
      year
    );

    return success(c, { removed: true });
  } catch (err) {
    console.error('Failed to remove editor pick:', err);
    return error(c, 'Failed to remove editor pick', 500);
  }
});

app.post('/heartbeat', async (c) => {
  try {
    applyDataOwnership(c, 'analytics.post_stats');
    const body = await c.req.json<{ visitorId?: string }>().catch(() => ({ visitorId: undefined }));
    const kv = c.env.KV;
    
    // Generate or use provided visitor ID
    const visitorId = body.visitorId || crypto.randomUUID();
    const key = `visitor:${visitorId}`;
    
    // Store with 60-second TTL
    await kv.put(key, Date.now().toString(), { expirationTtl: 60 });
    
    return success(c, { visitorId, recorded: true });
  } catch (err) {
    console.error('Failed to record heartbeat:', err);
    return error(c, 'Failed to record heartbeat', 500);
  }
});

/**
 * GET /api/v1/analytics/realtime
 * Get current active visitor count
 */
app.get('/realtime', async (c) => {
  try {
    const kv = c.env.KV;
    
    // List all visitor keys (KV list with prefix)
    const list = await kv.list({ prefix: 'visitor:' });
    const activeCount = list.keys.length;
    
    return success(c, { 
      activeVisitors: activeCount,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('Failed to get realtime count:', err);
    return error(c, 'Failed to get realtime count', 500);
  }
});

export default app;
