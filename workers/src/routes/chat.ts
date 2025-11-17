import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types';
import { generateContent } from '../lib/gemini';
import { success, badRequest } from '../lib/response';

type ChatContext = { Bindings: Env };

const chat = new Hono<ChatContext>();
async function proxyRequest(c: Context<ChatContext>, path: string) {
  const aiServeBaseUrl = c.env.AI_SERVE_BASE_URL || 'https://ai-check.nodove.com';
  const upstreamUrl = `${aiServeBaseUrl}${path}`;

  const upstreamHeaders = new Headers(c.req.raw.headers);
  upstreamHeaders.delete('host');

  if (c.env.AI_GATEWAY_CALLER_KEY) {
    upstreamHeaders.set('X-Gateway-Caller-Key', c.env.AI_GATEWAY_CALLER_KEY);
  }
  if (c.env.OPENCODE_AUTH_TOKEN) {
    upstreamHeaders.set('Authorization', `Bearer ${c.env.OPENCODE_AUTH_TOKEN}`);
  } else if (c.env.GITHUB_TOKEN) {
    upstreamHeaders.set('Authorization', `Bearer ${c.env.GITHUB_TOKEN}`);
  }

  const upstreamRequest = new Request(upstreamUrl, {
    method: c.req.method,
    headers: upstreamHeaders,
    body: c.req.raw.body,
    redirect: 'manual',
  });

  const upstreamResponse = await fetch(upstreamRequest);

  const headers = new Headers(upstreamResponse.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', '*');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  });
}

// '/session' 경로의 POST 요청은 업스트림 '/session'으로 프록시합니다.
chat.post('/session', async (c: Context<ChatContext>) => {
  return proxyRequest(c, '/session');
});

chat.post('/session/:sessionId/message', async (c: Context<ChatContext>) => {
  const { sessionId } = c.req.param();
  return proxyRequest(c, `/session/${sessionId}/message`);
});

// POST /chat/aggregate - 통합 질문 (여러 세션 요약 + 하나의 응답)
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
    const text = await generateContent(systemPrompt, c.env, {
      temperature: 0.2,
    });
    return success(c, { text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'aggregate failed';
    return badRequest(c, message);
  }
});

export default chat;
