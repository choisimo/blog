/**
 * Chat Routes
 *
 * 챗봇 및 Inline AI Task(sketch/prism/chain) 처리를 담당합니다.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types';
import { createAIService } from '../lib/ai-service';
import { success, badRequest, error } from '../lib/response';
import { AI_TEMPERATURES } from '../config/defaults';
import {
  buildTaskPrompt,
  isValidTaskMode,
  getFallbackData,
  type TaskMode,
  type TaskPayload,
} from '../lib/prompts';
import { executeTask } from '../lib/llm';
import { getCorsHeadersForRequest } from '../lib/cors';
import { getAiDefaultModel, getAiVisionModel } from '../lib/config';
import { requireAdmin } from '../middleware/auth';
import type { LensCard, ThoughtCard } from '../lib/feed-contract';
import {
  buildLensFeedFallback,
  buildThoughtFeedFallback,
  normalizeLensFeedRequest,
  normalizeThoughtFeedRequest,
} from '../lib/feed-normalizers';
import {
  enqueueFeedArtifactGeneration,
  getServeableFeedPage,
} from '../lib/ai-artifact-outbox';

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
  const body = await c.req.json().catch(() => ({}));
  const {
    mode,
    payload,
    prompt: legacyPrompt,
  } = body as {
    mode?: string;
    payload?: TaskPayload;
    context?: { url?: string; title?: string };
    prompt?: string;
  };

  const taskMode: TaskMode = isValidTaskMode(mode || '') ? (mode as TaskMode) : 'custom';
  const taskPayload: TaskPayload = payload || {};

  if (legacyPrompt && legacyPrompt.trim() && taskMode === 'custom') {
    taskPayload.prompt = legacyPrompt;
  }

  const content = taskPayload.paragraph || taskPayload.content || taskPayload.prompt || '';
  if (!content.trim()) {
    return badRequest(c, 'No content provided for task');
  }

  try {
    const promptConfig = buildTaskPrompt(taskMode, taskPayload);
    const result = await executeTask(taskMode, promptConfig, taskPayload, c.env);

    if (result.ok) {
      return success(c, {
        data: result.data,
        mode: taskMode,
        source: result.source,
      });
    }

    console.warn('Task execution failed, returning fallback:', result.error);
    return success(c, {
      data: result.data,
      mode: taskMode,
      source: 'fallback',
      _fallback: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Task execution failed';
    console.error('Task error:', message);

    try {
      const fallbackData = getFallbackData(taskMode, taskPayload);
      return success(c, {
        data: fallbackData,
        mode: taskMode,
        source: 'fallback',
        _fallback: true,
        _error: message,
      });
    } catch {
      return error(c, message, 500, 'INTERNAL_ERROR');
    }
  }
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
    });
  }

  await enqueueFeedArtifactGeneration(c.env, {
    artifactType: 'feed.lens',
    sessionId,
    paragraph: input.paragraph,
    postTitle: input.postTitle,
    count: input.count,
  });

  const fallback = buildLensFeedFallback(input);
  return success(c, {
    ...fallback,
    snapshotId: null,
    generationVersionHash: served.generationVersionHash,
    warming: true,
    stale: false,
    unreadCount: 0,
    itemStates: [],
    source: 'warming-fallback',
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
    });
  }

  await enqueueFeedArtifactGeneration(c.env, {
    artifactType: 'feed.thought',
    sessionId,
    paragraph: input.paragraph,
    postTitle: input.postTitle,
    count: input.count,
  });

  const fallback = buildThoughtFeedFallback(input);
  return success(c, {
    ...fallback,
    snapshotId: null,
    generationVersionHash: served.generationVersionHash,
    warming: true,
    stale: false,
    unreadCount: 0,
    itemStates: [],
    source: 'warming-fallback',
  });
});

chat.post('/aggregate', async (c: Context<ChatContext>) => {
  const body = await c.req.json().catch(() => ({}));
  const { prompt } = body as { prompt?: string };

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return badRequest(c, 'prompt is required');
  }

  const systemPrompt = [
    '다음 입력에는 여러 대화 세션의 요약과 사용자의 통합 질문이 함께 포함되어 있습니다.',
    '먼저 세션 요약들을 충분히 이해한 뒤, 사용자의 요청에 따라 전체를 한 번에 통합하여 답변해 주세요.',
    '- 공통된 핵심 아이디어',
    '- 서로 다른 관점이나 긴장 지점',
    '- 다음 액션/실천 아이디어',
    '를 중심으로 한국어로 정리해 주세요.',
    '',
    '---',
    '',
    prompt.trim(),
  ].join('\n');

  try {
    const aiService = createAIService(c.env);
    const text = await aiService.generate(systemPrompt, {
      temperature: AI_TEMPERATURES.AGGREGATE,
    });
    return success(c, { text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'aggregate failed';
    return error(c, message, 500, 'INTERNAL_ERROR');
  }
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
