import { Hono } from 'hono';
import type { Context } from 'hono';
import type { HonoEnv, PostStats, EditorPick } from '../types';
import { queryOne, queryAll, execute } from '../lib/d1';
import { success, error, badRequest, notFound } from '../lib/response';
import { proxyToBackendWithPolicy } from '../lib/backend-proxy';
import { requireAdmin } from '../middleware/auth';
import { buildDataOwnershipHeaders } from '../../../../shared/src/contracts/data-ownership.js';
import {
  replaceActiveEditorPicks,
  selectTopEditorPicks,
  type EditorPickStatRow,
} from '../lib/editor-picks';

// ---------------------------------------------------------------------------
// Backend proxy helper
// IMPORTANT: Use BACKEND_ORIGIN directly, NOT getApiBaseUrl() — that resolves
// to api.example.com (this worker itself) and would cause an infinite loop.
// ---------------------------------------------------------------------------
async function proxyToBackend(
  c: Context<HonoEnv>,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  query?: string
): Promise<{ ok: boolean; data?: unknown; error?: string; status: number }> {
  const response = await proxyToBackendWithPolicy(c, {
    upstreamPath: `/api/v1/analytics${path}${query ? `?${query}` : ''}`,
    method,
    preserveQuery: !query,
    overrideBody: body !== undefined ? JSON.stringify(body) : undefined,
    contentType: body !== undefined ? 'application/json' : undefined,
    backendUnavailableMessage: 'Could not connect to analytics backend',
  });

  const json = await response.clone().json().catch(() => null);
  const errorValue = (json as { error?: { message?: string } | string } | null)?.error;

  return {
    ok: response.ok,
    data: json ?? undefined,
    error:
      typeof errorValue === 'string'
        ? errorValue
        : errorValue && typeof errorValue === 'object'
          ? (errorValue.message ?? undefined)
          : undefined,
    status: response.status,
  };
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

    const result = await proxyToBackend(c, '/view', 'POST', body);
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

    const result = await proxyToBackend(c, `/stats/${year}/${slug}`, 'GET');
    if (!result.ok) {
      console.warn('Backend stats proxy failed:', result.error || result.status);
      return c.json(
        {
          ok: false,
          error: {
            code: 'ANALYTICS_BACKEND_UNAVAILABLE',
            message: 'Analytics backend unavailable',
          },
          degraded: true,
          sourceStatus: result.status || 503,
        },
        503
      );
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
    const result = await proxyToBackend(c, '/trending', 'GET', undefined, query);
    if (!result.ok) {
      console.warn('Backend trending proxy failed:', result.error || result.status);
      return c.json(
        {
          ok: false,
          error: {
            code: 'ANALYTICS_BACKEND_UNAVAILABLE',
            message: 'Analytics backend unavailable',
          },
          degraded: true,
          sourceStatus: result.status || 503,
        },
        503
      );
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
    const result = await proxyToBackend(c, '/refresh-stats', 'POST');
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
      c,
      '/all-stats',
      'GET',
      undefined,
      'limit=10&orderBy=total_views'
    );
    if (!statsResult.ok) {
      console.error('Failed to fetch all-stats from backend:', statsResult.error || statsResult.status);
      return error(c, 'Failed to fetch stats from backend', statsResult.status as 500 | 503);
    }

    const statsPayload = statsResult.data as {
      ok?: boolean;
      data?: { stats?: EditorPickStatRow[] };
    } | null;
    const allStats = statsPayload?.data?.stats || [];
    const topPicks = selectTopEditorPicks(allStats);

    if (topPicks.length === 0) {
      return success(c, { message: 'No posts with views found' });
    }

    await replaceActiveEditorPicks(db, topPicks);

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
