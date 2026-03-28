/**
 * Chat Routes
 *
 * 챗봇 및 Inline AI Task(sketch/prism/chain) 처리를 담당합니다.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types';
import { success, badRequest, error } from '../lib/response';
import { getCorsHeadersForRequest } from '../lib/cors';
import { getAiDefaultModel, getAiVisionModel } from '../lib/config';
import { requireAdmin } from '../middleware/auth';
import type { LensCard, ThoughtCard } from '../lib/feed-contract';
import {
  normalizeLensFeedRequest,
  normalizeThoughtFeedRequest,
} from '../lib/feed-normalizers';
import { enqueueFeedArtifactGeneration, generateAndStoreInitialFeedArtifact, getServeableFeedPage } from '../lib/ai-artifact-outbox';

type ChatContext = { Bindings: Env };

const chat = new Hono<ChatContext>();

type ProxyOptions = {
  sanitizeClientModel?: boolean;
};

async function proxyRequest(c: Context<ChatContext>, path: string, options: ProxyOptions = {}) {
  const backendOrigin = c.env.BACKEND_ORIGIN;
  if (!backendOrigin) {
    return error(c, 'BACKEND_ORIGIN not configured', 500, 'CONFIGURATION_ERROR');
  }
  const upstreamUrl = `${backendOrigin}/api/v1/chat${path}`;

  const upstreamHeaders = new Headers(c.req.raw.headers);
  upstreamHeaders.delete('host');
  upstreamHeaders.set('Host', 'blog-b.nodove.com');

  if (c.env.BACKEND_KEY) {
    upstreamHeaders.set('X-Backend-Key', c.env.BACKEND_KEY);
  }

  const [forcedModel, forcedVisionModel] = await Promise.all([
    getAiDefaultModel(c.env),
    getAiVisionModel(c.env),
  ]);
  if (forcedModel) {
    upstreamHeaders.set('X-AI-Model', forcedModel);
  }
  if (forcedVisionModel) {
    upstreamHeaders.set('X-AI-Vision-Model', forcedVisionModel);
  }

  if (!upstreamHeaders.has('Authorization') && c.env.OPENCODE_AUTH_TOKEN) {
    upstreamHeaders.set('Authorization', `Bearer ${c.env.OPENCODE_AUTH_TOKEN}`);
  }

  let upstreamBody: BodyInit | null | undefined = c.req.raw.body;
  if (options.sanitizeClientModel && !['GET', 'HEAD'].includes(c.req.method)) {
    const contentType = (c.req.header('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const rawBody = await c.req.raw.text();
      if (rawBody.trim()) {
        try {
          const payload = JSON.parse(rawBody) as Record<string, unknown>;
          if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
            const sanitized = { ...payload };
            delete sanitized.model;
            upstreamBody = JSON.stringify(sanitized);
          } else {
            upstreamBody = rawBody;
          }
        } catch {
          upstreamBody = rawBody;
        }
      } else {
        upstreamBody = rawBody;
      }
    }
  }

  const upstreamRequest = new Request(upstreamUrl, {
    method: c.req.method,
    headers: upstreamHeaders,
    body: upstreamBody,
    redirect: 'manual',
  });

  const upstreamResponse = await fetch(upstreamRequest);
  const headers = new Headers(upstreamResponse.headers);
  const corsHeaders = await getCorsHeadersForRequest(c.req.raw, c.env);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  });
}

chat.post('/session', async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/session');
});

chat.post('/session/:sessionId/message', async (c: Context<ChatContext>) => {
  const { sessionId } = c.req.param();
  return proxyRequest(c, `/session/${sessionId}/message`, {
    sanitizeClientModel: true,
  });
});

chat.post('/session/:sessionId/task', async (c: Context<ChatContext>) => {
  const { sessionId } = c.req.param();
  return proxyRequest(c, `/session/${sessionId}/task`, {
    sanitizeClientModel: true,
  });
});

chat.post('/session/:sessionId/lens-feed', async (c: Context<ChatContext>) => {
  const { sessionId } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  const input = normalizeLensFeedRequest(body);

  if (!input) {
    return badRequest(c, 'No content provided for lens feed');
  }

  const served = await getServeableFeedPage<LensCard>(c.env, {
    artifactType: 'feed.lens',
    sessionId,
    paragraph: input.paragraph,
    postTitle: input.postTitle,
    pageNo: input.cursor.page,
  });

  if (served.page) {
    if (served.stale) {
      await enqueueFeedArtifactGeneration(c.env, {
        artifactType: 'feed.lens',
        sessionId,
        paragraph: input.paragraph,
        postTitle: input.postTitle,
        count: input.count,
      });
    }

    return success(c, {
      ...served.page.payload,
      snapshotId: served.page.versionId,
      generationVersionHash: served.generationVersionHash,
      warming: served.warming,
      stale: served.stale,
      unreadCount: served.readState.unreadCount,
      itemStates: served.readState.itemStates,
      source: served.stale ? 'snapshot-stale' : 'snapshot',
      exhausted: served.warming ? false : served.page.payload.exhausted,
      nextCursor: served.warming ? null : served.page.payload.nextCursor,
    });
  }

  if (input.cursor.page === 0) {
    try {
      await generateAndStoreInitialFeedArtifact(c.env, {
        artifactType: 'feed.lens',
        sessionId,
        paragraph: input.paragraph,
        postTitle: input.postTitle,
        count: 4,
      });
      const fresh = await getServeableFeedPage<LensCard>(c.env, {
        artifactType: 'feed.lens',
        sessionId,
        paragraph: input.paragraph,
        postTitle: input.postTitle,
        pageNo: 0,
      });
      if (fresh.page) {
        return success(c, {
          ...fresh.page.payload,
          snapshotId: fresh.page.versionId,
          generationVersionHash: fresh.generationVersionHash,
          warming: false,
          stale: false,
          unreadCount: fresh.readState.unreadCount,
          itemStates: fresh.readState.itemStates,
          source: 'snapshot' as const,
          exhausted: fresh.page.payload.exhausted,
          nextCursor: fresh.page.payload.nextCursor,
        });
      }
    } catch (err) {
      console.warn('[lens-feed] inline generation failed, falling back to async', err);
    }
  }

  await enqueueFeedArtifactGeneration(c.env, {
    artifactType: 'feed.lens',
    sessionId,
    paragraph: input.paragraph,
    postTitle: input.postTitle,
    count: input.count,
  });

  c.header('Retry-After', '3');
  return success(c, {
    items: [],
    snapshotId: null,
    generationVersionHash: served.generationVersionHash,
    warming: true,
    stale: false,
    unreadCount: 0,
    itemStates: [],
    source: 'warming',
    exhausted: false,
    nextCursor: null,
  });
});

chat.post('/session/:sessionId/thought-feed', async (c: Context<ChatContext>) => {
  const { sessionId } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  const input = normalizeThoughtFeedRequest(body);

  if (!input) {
    return badRequest(c, 'No content provided for thought feed');
  }

  const served = await getServeableFeedPage<ThoughtCard>(c.env, {
    artifactType: 'feed.thought',
    sessionId,
    paragraph: input.paragraph,
    postTitle: input.postTitle,
    pageNo: input.cursor.page,
  });

  if (served.page) {
    if (served.stale) {
      await enqueueFeedArtifactGeneration(c.env, {
        artifactType: 'feed.thought',
        sessionId,
        paragraph: input.paragraph,
        postTitle: input.postTitle,
        count: input.count,
      });
    }

    return success(c, {
      ...served.page.payload,
      snapshotId: served.page.versionId,
      generationVersionHash: served.generationVersionHash,
      warming: served.warming,
      stale: served.stale,
      unreadCount: served.readState.unreadCount,
      itemStates: served.readState.itemStates,
      source: served.stale ? 'snapshot-stale' : 'snapshot',
      exhausted: served.warming ? false : served.page.payload.exhausted,
      nextCursor: served.warming ? null : served.page.payload.nextCursor,
    });
  }

  if (input.cursor.page === 0) {
    try {
      await generateAndStoreInitialFeedArtifact(c.env, {
        artifactType: 'feed.thought',
        sessionId,
        paragraph: input.paragraph,
        postTitle: input.postTitle,
        count: 4,
      });
      const fresh = await getServeableFeedPage<ThoughtCard>(c.env, {
        artifactType: 'feed.thought',
        sessionId,
        paragraph: input.paragraph,
        postTitle: input.postTitle,
        pageNo: 0,
      });
      if (fresh.page) {
        return success(c, {
          ...fresh.page.payload,
          snapshotId: fresh.page.versionId,
          generationVersionHash: fresh.generationVersionHash,
          warming: false,
          stale: false,
          unreadCount: fresh.readState.unreadCount,
          itemStates: fresh.readState.itemStates,
          source: 'snapshot' as const,
          exhausted: fresh.page.payload.exhausted,
          nextCursor: fresh.page.payload.nextCursor,
        });
      }
    } catch (err) {
      console.warn('[thought-feed] inline generation failed, falling back to async', err);
    }
  }

  await enqueueFeedArtifactGeneration(c.env, {
    artifactType: 'feed.thought',
    sessionId,
    paragraph: input.paragraph,
    postTitle: input.postTitle,
    count: input.count,
  });

  c.header('Retry-After', '3');
  return success(c, {
    items: [],
    snapshotId: null,
    generationVersionHash: served.generationVersionHash,
    warming: true,
    stale: false,
    unreadCount: 0,
    itemStates: [],
    source: 'warming',
    exhausted: false,
    nextCursor: null,
  });
});
chat.post('/aggregate', async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/aggregate', {
    sanitizeClientModel: true,
  });
});

chat.get('/live/stream', async (c: Context<ChatContext>) => {
  const query = c.req.url.split('?')[1] || '';
  return proxyRequest(c, `/live/stream${query ? `?${query}` : ''}`);
});

chat.post('/live/message', async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/live/message', {
    sanitizeClientModel: true,
  });
});

chat.get('/live/config', async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/live/config');
});

chat.put('/live/config', requireAdmin, async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/live/config');
});

chat.get('/live/room-stats', requireAdmin, async (c: Context<ChatContext>) => {
  const query = c.req.url.split('?')[1] || '';
  return proxyRequest(c, `/live/room-stats${query ? `?${query}` : ''}`);
});

chat.get('/live/rooms', requireAdmin, async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/live/rooms');
});

export default chat;
