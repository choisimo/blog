/**
 * Chat Routes
 *
 * 챗봇 및 Inline AI Task(sketch/prism/chain) 처리를 담당합니다.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types';
import { success, badRequest } from '../lib/response';
import { requireAdmin } from '../middleware/auth';
import type { LensCard, ThoughtCard } from '../lib/feed-contract';
import {
  normalizeLensFeedRequest,
  normalizeThoughtFeedRequest,
} from '../lib/feed-normalizers';
import { enqueueFeedArtifactGeneration, generateAndStoreInitialFeedArtifact, getServeableFeedPage } from '../lib/ai-artifact-outbox';
import { proxyToBackendWithPolicy } from '../lib/backend-proxy';

type ChatContext = { Bindings: Env };

const chat = new Hono<ChatContext>();

type ProxyOptions = {
  sanitizeClientModel?: boolean;
  stream?: boolean;
};

async function proxyRequest(c: Context<ChatContext>, path: string, options: ProxyOptions = {}) {
  return proxyToBackendWithPolicy(c, {
    upstreamPath: `/api/v1/chat${path}`,
    sanitizeClientModel: options.sanitizeClientModel,
    stream: options.stream,
    forceAiModels: true,
    backendUnavailableMessage: 'Could not connect to chat backend',
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
  return proxyRequest(c, `/live/stream${query ? `?${query}` : ''}`, {
    stream: true,
  });
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
