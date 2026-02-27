/**
 * Chat Routes
 *
 * 챗봇 및 Inline AI Task(sketch/prism/chain) 처리를 담당합니다.
 *
 * 엔드포인트:
 * - POST /session - 새 세션 생성 (프록시)
 * - POST /session/:id/message - 챗봇 메시지 (프록시, SSE 지원)
 * - POST /session/:id/task - Inline AI Task (서버 사이드 프롬프트 생성)
 * - POST /aggregate - 통합 질문 처리
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

type ChatContext = { Bindings: Env };

const chat = new Hono<ChatContext>();

type ProxyOptions = {
  sanitizeClientModel?: boolean;
};

/**
 * 업스트림 AI 서비스로 요청을 프록시합니다.
 * 챗봇 메시지(SSE 스트리밍) 및 세션 생성에 사용됩니다.
 *
 * Uses BACKEND_ORIGIN to avoid circular calls (api.nodove.com -> api.nodove.com).
 */
async function proxyRequest(c: Context<ChatContext>, path: string, options: ProxyOptions = {}) {
  // Use BACKEND_ORIGIN directly to avoid calling Workers itself
  const backendOrigin = c.env.BACKEND_ORIGIN;
  if (!backendOrigin) {
    return error(c, 'BACKEND_ORIGIN not configured', 500, 'CONFIGURATION_ERROR');
  }
  // Backend expects full path: /api/v1/chat/...
  const upstreamUrl = `${backendOrigin}/api/v1/chat${path}`;

  const upstreamHeaders = new Headers(c.req.raw.headers);
  upstreamHeaders.delete('host');
  upstreamHeaders.set('Host', 'blog-b.nodove.com');

  // Use BACKEND_KEY for backend authentication
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

  // Do not overwrite client's Authorization header if it already exists
  if (!upstreamHeaders.has('Authorization')) {
    if (c.env.OPENCODE_AUTH_TOKEN) {
      upstreamHeaders.set('Authorization', `Bearer ${c.env.OPENCODE_AUTH_TOKEN}`);
    } else if (c.env.GITHUB_TOKEN) {
      upstreamHeaders.set('Authorization', `Bearer ${c.env.GITHUB_TOKEN}`);
    }
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

/**
 * POST /session - 새 세션 생성
 * 업스트림 서비스로 프록시합니다.
 */
chat.post('/session', async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/session');
});

/**
 * POST /session/:sessionId/message - 챗봇 메시지
 * SSE 스트리밍을 지원하며, 업스트림 서비스로 프록시합니다.
 */
chat.post('/session/:sessionId/message', async (c: Context<ChatContext>) => {
  const { sessionId } = c.req.param();
  return proxyRequest(c, `/session/${sessionId}/message`, {
    sanitizeClientModel: true,
  });
});

/**
 * POST /session/:sessionId/task - Inline AI Task 실행
 *
 * sketch, prism, chain 등의 AI 작업을 처리합니다.
 * 프론트엔드는 mode와 payload만 전송하고, 프롬프트는 서버에서 생성합니다.
 *
 * Request Body:
 * {
 *   mode: 'sketch' | 'prism' | 'chain' | 'catalyst' | 'summary' | 'custom',
 *   payload: { paragraph, postTitle, persona, ... },
 *   context?: { url, title }
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   data: { ... },  // 모드별 결과
 *   mode: string,
 *   source: 'ai-call' | 'gemini' | 'fallback'
 * }
 */
chat.post('/session/:sessionId/task', async (c: Context<ChatContext>) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    mode,
    payload,
    context,
    prompt: legacyPrompt,
  } = body as {
    mode?: string;
    payload?: TaskPayload;
    context?: { url?: string; title?: string };
    prompt?: string; // 하위 호환성을 위해 유지
  };

  // 모드 검증
  const taskMode: TaskMode = isValidTaskMode(mode || '') ? (mode as TaskMode) : 'custom';
  const taskPayload: TaskPayload = payload || {};

  // 하위 호환성: 프론트엔드가 아직 prompt를 보내는 경우
  // 새로운 프론트엔드는 payload만 보내므로, legacyPrompt가 있으면 custom 모드로 처리
  if (legacyPrompt && legacyPrompt.trim() && taskMode === 'custom') {
    taskPayload.prompt = legacyPrompt;
  }

  // payload 검증
  const content = taskPayload.paragraph || taskPayload.content || taskPayload.prompt || '';
  if (!content.trim()) {
    return badRequest(c, 'No content provided for task');
  }

  try {
    // 서버 사이드 프롬프트 생성
    const promptConfig = buildTaskPrompt(taskMode, taskPayload);

    // 통합 LLM 레이어를 통해 실행
    const result = await executeTask(taskMode, promptConfig, taskPayload, c.env);

    if (result.ok) {
      return success(c, {
        data: result.data,
        mode: taskMode,
        source: result.source,
      });
    } else {
      // 폴백 데이터 반환 (에러지만 200으로 응답)
      console.warn('Task execution failed, returning fallback:', result.error);
      return success(c, {
        data: result.data,
        mode: taskMode,
        source: 'fallback',
        _fallback: true,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Task execution failed';
    console.error('Task error:', message);

    // 에러 시에도 폴백 데이터 반환 시도
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

/**
 * POST /aggregate - 통합 질문
 * 여러 세션의 요약을 받아 하나의 통합된 답변을 생성합니다.
 */
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

/**
 * GET /live/stream - 실시간 방문자 채팅 SSE
 */
chat.get('/live/stream', async (c: Context<ChatContext>) => {
  const query = c.req.url.split('?')[1] || '';
  return proxyRequest(c, `/live/stream${query ? `?${query}` : ''}`);
});

/**
 * POST /live/message - 실시간 방문자 메시지 전송
 */
chat.post('/live/message', async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/live/message', {
    sanitizeClientModel: true,
  });
});

/**
 * GET /live/config - live chat agent policy
 */
chat.get('/live/config', async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/live/config');
});

/**
 * PUT /live/config - update live chat agent policy
 */
chat.put('/live/config', async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/live/config');
});

/**
 * GET /live/room-stats?room=... - room telemetry
 */
chat.get('/live/room-stats', async (c: Context<ChatContext>) => {
  const query = c.req.url.split('?')[1] || '';
  return proxyRequest(c, `/live/room-stats${query ? `?${query}` : ''}`);
});

/**
 * GET /live/rooms - list active live chat rooms
 */
chat.get('/live/rooms', async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/live/rooms');
});

export default chat;
