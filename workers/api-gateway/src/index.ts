/**
 * Blog API Gateway - Unified Cloudflare Worker
 *
 * 통합된 블로그 API Gateway:
 * - 모든 /api/v1/* 라우트 처리 (D1, R2, KV 기반)
 * - backend-owned / proxy-only 경로만 origin 으로 프록시
 * - Cron 트리거 지원
 */

import { Hono } from 'hono';
import { buildPublicRuntimeConfig } from '@blog/shared/contracts/public-runtime-config';
import type { HonoEnv } from './types';
import { corsMiddleware } from './middleware/cors';
import { loggerMiddleware } from './middleware/logger';
import { tracingMiddleware } from './middleware/tracing';
import { errorHandler } from './middleware/error';
import { validateIapJwt } from './middleware/iap';
import { success } from './lib/response';
import { getCorsHeadersForRequest } from './lib/cors';
import { getApiBaseUrl, getAiDefaultModel, getAiVisionModel } from './lib/config';
import { attachOriginSignatureHeaders, stripOriginSignatureHeaders } from './lib/origin-signature';
import type { Env } from './types';
import { flushAiArtifactOutbox } from './lib/ai-artifact-outbox';
import { flushNotificationOutbox } from './lib/notification-outbox';
import {
  replaceActiveEditorPicks,
  selectTopEditorPicks,
  type EditorPickStatRow,
} from './lib/editor-picks';
import {
  buildProxyBoundaryHeaders,
  canProxyPath,
  registerWorkerRoutes,
} from './routes/registry';

const app = new Hono<HonoEnv>();

const PUBLIC_EDGE_BLOCKED_BACKEND_PREFIXES = ['/api/v1/agent', '/api/v1/execute'];

function isPublicEdgeBlockedBackendPath(pathname: string): boolean {
  return PUBLIC_EDGE_BLOCKED_BACKEND_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function proxyToBackend(request: Request, env: Env): Promise<Response> {
  const backendOrigin = env.BACKEND_ORIGIN;
  const url = new URL(request.url);

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
      },
    );
  }

  if (isPublicEdgeBlockedBackendPath(url.pathname)) {
    const corsHeaders = await getCorsHeadersForRequest(request, env);
    return new Response(
      JSON.stringify({
        error: 'Route not exposed',
        message: `${url.pathname} is not exposed through the public edge`,
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
          ...buildProxyBoundaryHeaders(url.pathname, request.method),
        },
      },
    );
  }

  if (!canProxyPath(url.pathname, request.method)) {
    const corsHeaders = await getCorsHeadersForRequest(request, env);
    return new Response(
      JSON.stringify({
        error: 'Route ownership violation',
        message: `${url.pathname} is not allowed to fall through to backend proxy`,
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
          ...buildProxyBoundaryHeaders(url.pathname, request.method),
        },
      },
    );
  }

  const backendUrl = new URL(url.pathname + url.search, backendOrigin);
  const headers = new Headers(request.headers);
  headers.delete('Host');
  headers.delete('X-Backend-Key');
  headers.delete('X-Internal-Gateway-Key');
  headers.delete('X-AI-Model');
  headers.delete('X-AI-Vision-Model');
  stripOriginSignatureHeaders(headers);

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
      headers.set('X-AI-Model-Source', 'gateway');
    }
    if (forcedVisionModel && isVisionPath) {
      headers.set('X-AI-Vision-Model', forcedVisionModel);
      headers.set('X-AI-Vision-Model-Source', 'gateway');
    }
  }

  await attachOriginSignatureHeaders({
    env,
    headers,
    method: request.method,
    pathAndQuery: `${backendUrl.pathname}${backendUrl.search}`,
    requestId: headers.get('X-Request-ID') || undefined,
  });

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

    responseHeaders.delete('Access-Control-Allow-Origin');
    responseHeaders.delete('Access-Control-Allow-Credentials');
    responseHeaders.delete('Access-Control-Allow-Methods');
    responseHeaders.delete('Access-Control-Allow-Headers');
    responseHeaders.delete('Access-Control-Max-Age');

    for (const [key, value] of Object.entries(corsHeaders)) {
      responseHeaders.set(key, value);
    }
    for (const [key, value] of Object.entries(
      buildProxyBoundaryHeaders(url.pathname, request.method)
    ) as [string, string][]) {
      responseHeaders.set(key, value);
    }

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
        },
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
          ...buildProxyBoundaryHeaders(url.pathname, request.method),
        },
      },
    );
  }
}

app.use('*', corsMiddleware);
app.use('*', validateIapJwt);
app.use('*', loggerMiddleware);
app.use('/api/v1/ai/*', tracingMiddleware);
app.use('/api/v1/chat/*', tracingMiddleware);

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

app.get('/api/v1/readiness', async (c) => {
  return proxyToBackend(c.req.raw, c.env);
});

// Do not expose origin metrics through the public edge.
app.all('/metrics', async (c) => {
  const corsHeaders = await getCorsHeadersForRequest(c.req.raw, c.env);
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        message: 'Route not found: metrics',
        code: 'NOT_FOUND',
      },
    }),
    {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    },
  );
});

async function buildPublicConfig(env: Env) {
  const [apiBaseUrl, forcedModel, forcedVisionModel] = await Promise.all([
    getApiBaseUrl(env),
    getAiDefaultModel(env),
    getAiVisionModel(env),
  ]);
  const supportsChatWebSocket = false;
  const terminalEnabled = env.FEATURE_TERMINAL_ENABLED === 'true';
  return buildPublicRuntimeConfig({
    env: env.ENV,
    siteBaseUrl: env.PUBLIC_SITE_URL,
    apiBaseUrl,
    chatBaseUrl: apiBaseUrl,
    supportsChatWebSocket,
    terminalGatewayUrl: env.TERMINAL_GATEWAY_URL,
    ai: {
      modelSelectionEnabled: false,
      defaultModel: forcedModel || null,
      visionModel: forcedVisionModel || null,
    },
    features: {
      aiEnabled: env.FEATURE_AI_ENABLED === 'true',
      ragEnabled: env.FEATURE_RAG_ENABLED === 'true',
      terminalEnabled,
      aiInline: env.FEATURE_AI_INLINE === 'true',
      // /api/v1/execute is intentionally not exposed through the public edge.
      codeExecutionEnabled: false,
      commentsEnabled: env.FEATURE_COMMENTS_ENABLED === 'true',
    },
  });
}

app.get('/public/config', async (c) => {
  return success(c, await buildPublicConfig(c.env));
});

app.get('/api/v1/public/config', async (c) => {
  return success(c, await buildPublicConfig(c.env));
});

const api = new Hono<HonoEnv>();
registerWorkerRoutes(api);
app.route('/api/v1', api);

app.all('*', async (c) => {
  return proxyToBackend(c.req.raw, c.env);
});

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
          data?: { stats?: EditorPickStatRow[] };
        }>().catch(() => null);

        const allStats = statsData?.data?.stats || [];
        const topPicks = selectTopEditorPicks(allStats);

        if (topPicks.length > 0) {
          await replaceActiveEditorPicks(env.DB, topPicks);
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

    // 5. Flush durable notification deliveries that could not be sent inline.
    const notificationResult = await flushNotificationOutbox(env, {
      limit: 25,
    });
    console.log('Notification outbox scheduler result:', notificationResult);

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
