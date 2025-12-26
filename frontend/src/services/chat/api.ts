/**
 * Chat Service - API Functions
 *
 * 채팅 관련 API 호출 함수들
 */

import { getApiBaseUrl } from '@/utils/apiBase';
import { buildChatUrl, buildChatHeaders, isUnifiedTasksEnabled } from './config';
import { ensureSession } from './session';
import {
  getPageContext,
  getArticleTextSnippet,
  CHAT_STYLE_PROMPT,
  buildContextPrompt,
  buildImageContext,
  buildRAGContextPrompt,
  buildMemoryContextPrompt,
} from './context';
import {
  getParserForContentType,
  createFirstTokenTracker,
} from './stream';
import type {
  ChatStreamEvent,
  StreamChatInput,
  InvokeChatTaskInput,
  InvokeChatTaskResult,
  ChatImageUploadResult,
  ContentPart,
} from './types';

// ============================================================================
// Chat Task API
// ============================================================================

/**
 * AI 태스크 실행 (sketch, prism, chain 등)
 */
export async function invokeChatTask<T = unknown>(
  input: InvokeChatTaskInput
): Promise<InvokeChatTaskResult<T>> {
  if (!isUnifiedTasksEnabled()) {
    throw new Error('Unified chat task API is disabled');
  }

  const sessionID = await ensureSession();
  const url = buildChatUrl('/task', sessionID);
  const headers = buildChatHeaders('json');

  if (input.headers) Object.assign(headers, input.headers);

  const body = {
    mode: input.mode,
    prompt: input.prompt ?? '',
    payload: input.payload ?? {},
    context: input.context ?? getPageContext(),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: input.signal,
  });

  const text = await res.text().catch(() => '');
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const errorMessage =
      typeof parsed === 'object' && parsed !== null && 'error' in (parsed as any)
        ? String((parsed as any).error)
        : text.slice(0, 180) || `status ${res.status}`;
    const error = new Error(`Chat task error: ${errorMessage}`);
    (error as any).status = res.status;
    (error as any).response = parsed;
    throw error;
  }

  const dataCandidate =
    parsed && typeof parsed === 'object'
      ? (parsed as any).data ??
        (parsed as any).result ??
        (parsed as any).output ??
        (parsed as any).payload ??
        parsed
      : parsed;

  return {
    ok: true,
    status: res.status,
    data: (dataCandidate as T) ?? null,
    raw: parsed,
  };
}

// ============================================================================
// Chat Streaming API
// ============================================================================

/**
 * 채팅 메시지 스트리밍
 */
export async function* streamChatEvents(
  input: StreamChatInput
): AsyncGenerator<ChatStreamEvent, void, void> {
  const sessionID = await ensureSession();
  const url = buildChatUrl('/message', sessionID);
  const headers = buildChatHeaders('stream');

  // 페이지 컨텍스트
  const page = input.page || getPageContext();

  // 아티클 컨텍스트
  const shouldUseArticleContext =
    input.useArticleContext !== undefined ? input.useArticleContext : true;
  const articleSnippet = shouldUseArticleContext
    ? getArticleTextSnippet(4000)
    : null;

  // 콘텐츠 파트 구성
  const parts: ContentPart[] = [{ type: 'text', text: CHAT_STYLE_PROMPT }];

  // RAG 컨텍스트 추가
  if (input.ragContext) {
    const ragPrompt = buildRAGContextPrompt(input.ragContext);
    if (ragPrompt) parts.push({ type: 'text', text: ragPrompt });
  }

  // 사용자 메모리 컨텍스트 추가
  if (input.memoryContext) {
    const memoryPrompt = buildMemoryContextPrompt(input.memoryContext);
    if (memoryPrompt) parts.push({ type: 'text', text: memoryPrompt });
  }

  // 아티클 컨텍스트 추가
  const contextPrompt = buildContextPrompt(articleSnippet);
  if (contextPrompt) parts.push({ type: 'text', text: contextPrompt });

  // 사용자 입력 (이미지 포함 여부에 따라)
  if (input.imageUrl) {
    const imageContext = buildImageContext(
      input.imageUrl,
      input.imageAnalysis,
      input.text
    );
    parts.push({ type: 'text', text: imageContext });
  } else {
    parts.push({ type: 'text', text: input.text });
  }

  // 요청 전송
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parts,
      context: { page },
      model: input.model, // AI 모델 선택
    }),
    signal: input.signal,
  });

  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '');
    throw new Error(`Chat error: ${res.status} ${t.slice(0, 180)}`);
  }

  // 스트림 파싱
  const contentType = res.headers.get('content-type') || '';
  const parser = getParserForContentType(contentType);
  const markFirst = createFirstTokenTracker(input.onFirstToken);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;

      const events = parser.processChunk(chunk);
      for (const event of events) {
        if (event.type === 'text') markFirst();
        yield event;
      }
    }

    // 남은 버퍼 처리
    const finalEvents = parser.flush();
    for (const event of finalEvents) {
      if (event.type === 'text') markFirst();
      yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 간단한 텍스트 전용 스트리밍
 */
export async function* streamChatMessage(input: {
  text: string;
}): AsyncGenerator<string, void, void> {
  for await (const ev of streamChatEvents({ text: input.text })) {
    if (ev.type === 'text') yield ev.text;
  }
}

// ============================================================================
// Image Upload API
// ============================================================================

/**
 * 채팅용 이미지 업로드
 */
export async function uploadChatImage(
  file: File,
  signal?: AbortSignal
): Promise<ChatImageUploadResult> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/images/chat-upload`;
  const formData = new FormData();
  formData.append('file', file);

  if (process.env.NODE_ENV === 'development') {
    console.log('[ChatImage] Uploading to:', url);
  }

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    signal,
  });

  const text = await res.text().catch(() => '');
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok || !parsed?.ok) {
    const message =
      (parsed && parsed.error && parsed.error.message) ||
      text.slice(0, 180) ||
      `status ${res.status}`;
    throw new Error(`Chat image upload error: ${message}`);
  }

  const data = parsed.data;
  if (!data || typeof data.url !== 'string') {
    throw new Error('Invalid chat image upload response');
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[ChatImage] Upload success, analysis:', data.imageAnalysis ? 'OK' : 'NULL');
  }

  return data as ChatImageUploadResult;
}

// ============================================================================
// Aggregate API
// ============================================================================

/**
 * 여러 세션 통합 요약
 */
export async function invokeChatAggregate(input: {
  prompt: string;
  signal?: AbortSignal;
}): Promise<string> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/chat/aggregate`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: input.prompt }),
    signal: input.signal,
  });

  const text = await res.text().catch(() => '');
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok || !parsed?.ok) {
    const message =
      (parsed && parsed.error && parsed.error.message) ||
      text.slice(0, 180) ||
      `status ${res.status}`;
    throw new Error(`Chat aggregate error: ${message}`);
  }

  const data = parsed.data;
  const value =
    (data && typeof data.text === 'string' && data.text) ||
    (typeof data === 'string' ? data : null);

  if (!value) {
    throw new Error('Invalid chat aggregate response');
  }
  return value;
}
