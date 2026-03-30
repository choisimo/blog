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
import { getApiBaseUrl, getAiDefaultModel, getAiVisionModel } from './lib/config';

// Import routes
import auth from './routes/auth';
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
import adminOutbox from './routes/admin-outbox';
import secrets from './routes/secrets';
import internal from './routes/internal';
import personas from './routes/personas';
import userContent from './routes/user-content';
import search from './routes/search';
import user from './routes/user';
import debate from './routes/debate';
import subscribe from './routes/subscribe';
import contact from './routes/contact';
import notifications from './routes/notifications';
import adminLogs from './routes/admin-logs';
import type { Env } from './types';
import { flushAiArtifactOutbox } from './lib/ai-artifact-outbox';

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
    const corsHeaders = await getCorsHeadersForRequest(request, env);
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

  if (env.BACKEND_KEY) {
    headers.set('X-Backend-Key', env.BACKEND_KEY);
  }

  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Real-IP', request.headers.get('CF-Connecting-IP') || '');
  headers.set('X-Request-ID', crypto.randomUUID());
  headers.set('CF-Ray', request.headers.get('CF-Ray') || '');
  headers.set('CF-IPCountry', request.headers.get('CF-IPCountry') || '');

  const isAiOrChatPath =
    url.pathname.startsWith('/api/v1/ai') ||
    url.pathname.startsWith('/api/v1/chat') ||
    url.pathname.startsWith('/api/v1/agent');
  const isVisionPath =
    url.pathname.startsWith('/api/v1/images') || url.pathname.startsWith('/api/v1/ai/vision');

  if (isAiOrChatPath || isVisionPath) {
    const [forcedModel, forcedVisionModel] = await Promise.all([
      getAiDefaultModel(env),
      getAiVisionModel(env),
    ]);
    if (forcedModel) {
      headers.set('X-AI-Model', forcedModel);
    }
    if (forcedVisionModel && isVisionPath) {
      headers.set('X-AI-Vision-Model', forcedVisionModel);
    }
  }

  try {
    const response = await fetch(backendUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      // @ts-ignore - duplex is valid but not in types
      duplex: request.method !== 'GET' && request.method !== 'HEAD' ? 'half' : undefined,
    });

    const corsHeaders = await getCorsHeadersForRequest(request, env);
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

    if (response.status >= 502 && response.status <= 504) {
      console.error('Backend returned error status:', response.status);
      responseHeaders.delete('Content-Length');
      responseHeaders.set('Content-Type', 'application/json');
      responseHeaders.set('Retry-After', '30');

      return new Response(
        JSON.stringify({
          error: 'Backend unavailable',
          message: `Backend returned ${response.status}. Retry after 30 seconds.`,
          status: response.status,
        }),
        {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        }
      );
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Backend request failed:', error);

    const corsHeaders = await getCorsHeadersForRequest(request, env);
    return new Response(
      JSON.stringify({
        error: 'Backend unavailable',
        message: 'Could not connect to backend server',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '30',
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

app.get('/health', async (c) => {
  return proxyToBackend(c.req.raw, c.env);
});

async function buildPublicConfig(env: Env) {
  const [apiBaseUrl, forcedModel, forcedVisionModel] = await Promise.all([
    getApiBaseUrl(env),
    getAiDefaultModel(env),
    getAiVisionModel(env),
  ]);
  const terminalEnabled = env.FEATURE_TERMINAL_ENABLED === 'true';
  const chatWsBaseUrl = apiBaseUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');

  return {
    env: env.ENV,
    apiBaseUrl,
    chatBaseUrl: apiBaseUrl,
    chatWsBaseUrl,
    ai: {
      modelSelectionEnabled: false,
      defaultModel: forcedModel || null,
      visionModel: forcedVisionModel || null,
    },
    features: {
      aiEnabled: true,
      ragEnabled: true,
      terminalEnabled,
      aiInline: true,
      commentsEnabled: true,
    },
  };
}

app.get('/public/config', async (c) => {
  return success(c, await buildPublicConfig(c.env));
});

app.get('/api/v1/public/config', async (c) => {
  return success(c, await buildPublicConfig(c.env));
});

// =============================================================================
// Mount API Routes under /api/v1
// =============================================================================

const api = new Hono<HonoEnv>();
api.route('/auth', auth);
api.route('/comments', comments);
api.route('/ai', ai);
api.route('/chat', chat);
api.route('/images', images);
api.route('/og', og);
api.route('/analytics', analytics);
api.route('/', translate);
api.route('/config', config);
api.route('/rag', rag);
api.route('/memos', memos);
api.route('/memories', memories);
api.route('/admin/ai', adminAi);
api.route('/admin/outbox', adminOutbox);
api.route('/admin/secrets', secrets);
api.route('/internal', internal);
api.route('/personas', personas);
api.route('/user-content', userContent);
api.route('/search', search);
api.route('/user', user);
api.route('/debate', debate);
api.route('/subscribe', subscribe);
api.route('/contact', contact);
api.route('/notifications', notifications);
api.route('/admin/logs', adminLogs);
api.route('/gateway', gateway);
// /posts is backend-owned. Requests fall through to the backend proxy below.

app.route('/api/v1', api);

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
    // 1. Refresh post stats — delegate to Backend (Postgres is the canonical store).
    //    The backend /refresh-stats endpoint recalculates views_7d and views_30d.
    if (env.BACKEND_ORIGIN && env.BACKEND_KEY) {
      try {
        const refreshUrl = `${env.BACKEND_ORIGIN}/api/v1/analytics/refresh-stats`;
        const refreshResp = await fetch(refreshUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Backend-Key': env.BACKEND_KEY,
          },
        });
        const refreshData = await refreshResp.json<{ ok?: boolean; data?: { refreshed?: number } }>().catch(() => null);
        console.log(`Stats refresh: ${refreshResp.status}`, refreshData?.data?.refreshed ?? 0, 'rows');
      } catch (refreshErr) {
        console.error('Stats refresh failed (non-fatal):', refreshErr);
      }
    } else {
      console.warn('Skipping stats refresh: BACKEND_ORIGIN or BACKEND_KEY not configured');
    }

    // 2. Update editor picks — fetch top stats from Backend, cache picks in D1.
    //    Falls back to no-op if backend is unavailable.
    if (env.BACKEND_ORIGIN && env.BACKEND_KEY) {
      try {
        const statsUrl = `${env.BACKEND_ORIGIN}/api/v1/analytics/all-stats?limit=10&orderBy=total_views`;
        const statsResp = await fetch(statsUrl, {
          headers: { 'X-Backend-Key': env.BACKEND_KEY },
        });
        const statsData = await statsResp.json<{
          ok?: boolean;
          data?: { stats?: Array<{ post_slug: string; year: string; total_views: number; views_7d: number; views_30d: number }> };
        }>().catch(() => null);

        const allStats = statsData?.data?.stats || [];
        const scored = allStats
          .filter((s) => s.total_views > 0)
          .map((s) => ({
            ...s,
            score: s.views_7d * 0.5 + s.views_30d * 0.3 + s.total_views * 0.2,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);

        if (scored.length > 0) {
          const db = env.DB;
          await db.prepare(`UPDATE editor_picks SET is_active = 0, updated_at = datetime('now')`).run();

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 1);
          expiresAt.setHours(6, 0, 0, 0);
          const expiresAtStr = expiresAt.toISOString();

          const topPicks = scored.slice(0, 3);
          for (let i = 0; i < topPicks.length; i++) {
            const postItem = topPicks[i];
            if (!postItem) continue;
            let reason = 'Popular post';
            if (postItem.views_7d > postItem.views_30d * 0.5) reason = 'Trending this week';
            else if (postItem.total_views > 100) reason = 'Evergreen favorite';

            await db
              .prepare(
                `INSERT INTO editor_picks (post_slug, year, title, rank, score, reason, expires_at, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                 ON CONFLICT(post_slug, year)
                 DO UPDATE SET rank = ?, score = ?, reason = ?, expires_at = ?, is_active = 1, picked_at = datetime('now'), updated_at = datetime('now')`
              )
              .bind(
                postItem.post_slug, postItem.year, '', i + 1, postItem.score, reason, expiresAtStr,
                i + 1, postItem.score, reason, expiresAtStr
              )
              .run();
          }
          console.log(`Updated ${topPicks.length} editor picks from Backend stats`);
        }
      } catch (picksErr) {
        console.error('Editor picks update failed (non-fatal):', picksErr);
      }
    }

    // 3. Clean up old view records from D1 (older than 90 days).
    //    D1 post_views is now only used for editor-picks caching via cron.
    //    This retention cleanup keeps D1 storage bounded.
    const date90dCutoff = new Date();
    date90dCutoff.setDate(date90dCutoff.getDate() - 90);
    const date90dStr = date90dCutoff.toISOString().split('T')[0];
    const cleanupDb = env.DB;

    await cleanupDb.prepare(`DELETE FROM post_views WHERE view_date < ?`).bind(date90dStr).run();

    // 4. Flush durable artifact generation work when queue/provider health allows it.
    const artifactResult = await flushAiArtifactOutbox(env, {
      limit: 10,
    });
    console.log('Artifact scheduler result:', artifactResult);

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
