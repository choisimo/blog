/**
 * Blog API Gateway - Unified Cloudflare Worker
 *
 * 통합된 블로그 API Gateway:
 * - 모든 /api/v1/* 라우트 처리 (D1, R2, KV 기반)
 * - 백엔드 서버로 프록시 (fallback 또는 특정 경로)
 * - Cron 트리거 지원
 *
 * Architecture:
 *   Client → Cloudflare Workers (api.nodove.com) → Internal Routes OR → Backend Server
 */

import { Hono } from 'hono';
import type { HonoEnv } from './types';
import { corsMiddleware } from './middleware/cors';
import { loggerMiddleware } from './middleware/logger';
import { tracingMiddleware } from './middleware/tracing';
import { errorHandler } from './middleware/error';
import { success } from './lib/response';
import { getCorsHeadersForRequest } from './lib/cors';

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
import memories from './routes/memories';
import adminAi from './routes/admin-ai';
import secrets from './routes/secrets';
import personas from './routes/personas';
import userContent from './routes/user-content';
import search from './routes/search';
import user from './routes/user';
import debate from './routes/debate';
import type { Env } from './types';

const app = new Hono<HonoEnv>();

// =============================================================================
// Configuration
// =============================================================================

// NOTE: CORS helpers live in ./lib/cors.

// =============================================================================
// Backend Proxy (for routes not handled by Workers)
// =============================================================================

async function proxyToBackend(request: Request, env: Env): Promise<Response> {
  const backendOrigin = env.BACKEND_ORIGIN;
  if (!backendOrigin) {
    const corsHeaders = getCorsHeadersForRequest(request, env);
    return new Response(
      JSON.stringify({
        error: 'Configuration error',
        message: 'BACKEND_ORIGIN not configured',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const url = new URL(request.url);
  const backendUrl = new URL(url.pathname + url.search, backendOrigin);

  const headers = new Headers(request.headers);
  headers.delete('Host');
  headers.set('Host', 'blog-b.nodove.com');

  if (env.BACKEND_SECRET_KEY) {
    headers.set('X-Backend-Key', env.BACKEND_SECRET_KEY);
  }

  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Real-IP', request.headers.get('CF-Connecting-IP') || '');
  headers.set('X-Request-ID', crypto.randomUUID());
  headers.set('CF-Ray', request.headers.get('CF-Ray') || '');
  headers.set('CF-IPCountry', request.headers.get('CF-IPCountry') || '');

  try {
    const response = await fetch(backendUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      // @ts-ignore - duplex is valid but not in types
      duplex: request.method !== 'GET' && request.method !== 'HEAD' ? 'half' : undefined,
    });

    const corsHeaders = getCorsHeadersForRequest(request, env);
    const responseHeaders = new Headers(response.headers);

    // Prevent upstream CORS headers from causing Origin mismatch issues
    responseHeaders.delete('Access-Control-Allow-Origin');
    responseHeaders.delete('Access-Control-Allow-Credentials');
    responseHeaders.delete('Access-Control-Allow-Methods');
    responseHeaders.delete('Access-Control-Allow-Headers');
    responseHeaders.delete('Access-Control-Max-Age');

    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Backend request failed:', error);

    const corsHeaders = getCorsHeadersForRequest(request, env);
    return new Response(
      JSON.stringify({
        error: 'Backend unavailable',
        message: 'Could not connect to backend server',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

// =============================================================================
// Global Middlewares
// =============================================================================

app.use('*', corsMiddleware);
app.use('*', loggerMiddleware);
app.use('/api/v1/ai/*', tracingMiddleware);
app.use('/api/v1/chat/*', tracingMiddleware);

// =============================================================================
// Health & Status Endpoints
// =============================================================================

app.get('/_health', (c) => {
  return c.json({
    ok: true,
    worker: 'blog-api-gateway',
    timestamp: new Date().toISOString(),
  });
});

app.get('/healthz', (c) => {
  return success(c, {
    status: 'ok',
    env: c.env.ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get('/public/config', (c) => {
  return success(c, {
    env: c.env.ENV,
    features: {
      aiInline: true,
      comments: true,
    },
  });
});

// =============================================================================
// Mount API Routes under /api/v1
// =============================================================================

const api = new Hono<HonoEnv>();
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
api.route('/memories', memories);
api.route('/admin/ai', adminAi);
api.route('/admin/secrets', secrets);
api.route('/personas', personas);
api.route('/user-content', userContent);
api.route('/search', search);
api.route('/user', user);
api.route('/debate', debate);

app.route('/api/v1', api);

// =============================================================================
// Terminal Proxy (forward to backend nginx which handles terminal-server)
// =============================================================================

app.all('/terminal/*', async (c) => {
  return proxyToBackend(c.req.raw, c.env);
});

// =============================================================================
// Fallback: Proxy to Backend for unhandled routes
// =============================================================================

app.all('*', async (c) => {
  // If it's a route we don't handle, proxy to backend
  return proxyToBackend(c.req.raw, c.env);
});

// Error handler
app.onError(errorHandler);

// =============================================================================
// Scheduled Handler (Cron Triggers)
// =============================================================================

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

// =============================================================================
// Export
// =============================================================================

export default {
  fetch: app.fetch,
  scheduled,
};
