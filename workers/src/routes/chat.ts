import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types';
import { generateContent, tryParseJson } from '../lib/gemini';
import { success, badRequest } from '../lib/response';

type ChatContext = { Bindings: Env };

const chat = new Hono<ChatContext>();

// Task mode types
type TaskMode = 'sketch' | 'prism' | 'chain' | 'catalyst' | 'summary' | 'custom';

type SketchResult = {
  mood: string;
  bullets: string[];
};

type PrismResult = {
  facets: Array<{
    title: string;
    points: string[];
  }>;
};

type ChainResult = {
  questions: Array<{
    q: string;
    why: string;
  }>;
};

// Helper to truncate text safely
function safeTruncate(s: string, n: number): string {
  if (!s) return s;
  return s.length > n ? `${s.slice(0, n)}\n…(truncated)` : s;
}

// Build prompt for each task mode
function buildTaskPrompt(mode: TaskMode, payload: Record<string, unknown>): string {
  const paragraph = String(payload.paragraph || payload.content || '');
  const postTitle = String(payload.postTitle || payload.title || '');
  
  switch (mode) {
    case 'sketch':
      return [
        'You are a helpful writing companion. Return STRICT JSON only matching the schema.',
        '{"mood":"string","bullets":["string","string","..."]}',
        '',
        `Post: ${safeTruncate(postTitle, 120)}`,
        'Paragraph:',
        safeTruncate(paragraph, 1600),
        '',
        'Task: Capture the emotional sketch. Select a concise mood (e.g., curious, excited, skeptical) and 3-6 short bullets in the original language of the text.',
      ].join('\n');

    case 'prism':
      return [
        'Return STRICT JSON only for idea facets.',
        '{"facets":[{"title":"string","points":["string","string"]}]}',
        `Post: ${safeTruncate(postTitle, 120)}`,
        'Paragraph:',
        safeTruncate(paragraph, 1600),
        '',
        'Task: Provide 2-3 facets (titles) with 2-4 concise points each, in the original language.',
      ].join('\n');

    case 'chain':
      return [
        'Return STRICT JSON only for tail questions.',
        '{"questions":[{"q":"string","why":"string"}]}',
        `Post: ${safeTruncate(postTitle, 120)}`,
        'Paragraph:',
        safeTruncate(paragraph, 1600),
        '',
        'Task: Generate 3-5 short follow-up questions and a brief why for each, in the original language.',
      ].join('\n');

    case 'catalyst':
    case 'summary':
    case 'custom':
    default:
      // For custom modes, use the prompt directly if provided
      return payload.prompt ? String(payload.prompt) : paragraph;
  }
}

// Parse and validate task result
function parseTaskResult(mode: TaskMode, text: string): unknown {
  const parsed = tryParseJson(text);
  
  if (!parsed) {
    // Try extracting JSON from text
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const maybeJson = text.slice(start, end + 1);
      const retried = tryParseJson(maybeJson);
      if (retried) return retried;
    }
    throw new Error('Failed to parse AI response as JSON');
  }
  
  return parsed;
}
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

// POST /session/:sessionId/task - Execute AI task (sketch, prism, chain, etc.)
// Proxies to AIdove API (ai-call.nodove.com/auto-chat) for reliable AI generation
chat.post('/session/:sessionId/task', async (c: Context<ChatContext>) => {
  const body = await c.req.json().catch(() => ({}));
  const { mode, prompt, payload, context } = body as {
    mode?: string;
    prompt?: string;
    payload?: Record<string, unknown>;
    context?: { url?: string; title?: string };
  };

  const taskMode = (mode || 'custom') as TaskMode;
  const taskPayload = payload || {};
  
  // If prompt is provided, add it to payload for custom mode
  if (prompt && !taskPayload.prompt) {
    taskPayload.prompt = prompt;
  }

  // Build the appropriate prompt for the mode
  const aiPrompt = buildTaskPrompt(taskMode, taskPayload);
  
  if (!aiPrompt.trim()) {
    return badRequest(c, 'No content provided for task');
  }

  try {
    // Call AIdove API via ai-call gateway
    const aiCallBaseUrl = c.env.AI_CALL_BASE_URL || 'https://ai-call.nodove.com';
    const autoChatUrl = `${aiCallBaseUrl.replace(/\/$/, '')}/auto-chat`;

    const autoChatBody = {
      message: aiPrompt,
      mode: taskMode,
      responseFormat: 'json',
      context: {
        ...context,
        taskMode,
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Forward gateway caller key if available
    if (c.env.AI_GATEWAY_CALLER_KEY) {
      headers['X-Gateway-Caller-Key'] = c.env.AI_GATEWAY_CALLER_KEY;
    }

    const autoChatRes = await fetch(autoChatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(autoChatBody),
    });

    if (!autoChatRes.ok) {
      const errorText = await autoChatRes.text().catch(() => '');
      console.error('AIdove API error:', autoChatRes.status, errorText.slice(0, 200));
      throw new Error(`AIdove API error: ${autoChatRes.status}`);
    }

    const autoChatResult = await autoChatRes.json() as { 
      ok?: boolean;
      data?: { text?: string; content?: string; response?: string };
      text?: string;
      content?: string;
      response?: string;
    };

    // Extract text from various response formats
    const rawText = 
      autoChatResult?.data?.text || 
      autoChatResult?.data?.content || 
      autoChatResult?.data?.response ||
      autoChatResult?.text || 
      autoChatResult?.content || 
      autoChatResult?.response ||
      (typeof autoChatResult === 'string' ? autoChatResult : '');

    if (!rawText) {
      throw new Error('No content in AIdove response');
    }
    
    // Parse the result based on mode
    const data = parseTaskResult(taskMode, rawText);
    
    return success(c, { data, mode: taskMode });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Task execution failed';
    console.error('Task error:', message);
    return badRequest(c, message);
  }
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
