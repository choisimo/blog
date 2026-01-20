/**
 * Chat Service - API Functions
 *
 * 채팅 관련 API 호출 함수들
 */

import { getApiBaseUrl } from '@/utils/apiBase';
import {
  buildChatUrl,
  buildChatHeaders,
  isUnifiedTasksEnabled,
  buildChatWebSocketUrl,
  shouldUseChatWebSocket,
} from './config';
import { ensureSession, storeSessionId } from './session';
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
  parseStreamObject,
} from './stream';
import type {
  ChatStreamEvent,
  StreamChatInput,
  InvokeChatTaskInput,
  InvokeChatTaskResult,
  ChatImageUploadResult,
  ContentPart,
} from './types';
import { ChatError } from './types';

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
    throw ChatError.fromResponse(res.status, parsed);
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
  const { page, parts } = buildStreamPayload(input);

  if (shouldUseChatWebSocket()) {
    let gotEvent = false;
    try {
      for await (const event of streamChatEventsWebSocket({
        sessionId: sessionID,
        parts,
        page,
        signal: input.signal,
        onFirstToken: input.onFirstToken,
      })) {
        gotEvent = true;
        yield event;
      }
      return;
    } catch (err) {
      if (input.signal?.aborted) {
        throw err;
      }
      if (gotEvent) {
        throw err;
      }
      console.warn('[Chat] WebSocket failed, falling back to SSE:', err);
    }
  }

  const url = buildChatUrl('/message', sessionID);
  const headers = buildChatHeaders('stream');

  // 요청 전송
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parts,
      context: { page },
    }),
    signal: input.signal,
  });

  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '');
    let parsed: unknown = null;
    try { parsed = JSON.parse(t); } catch { void 0; }
    throw ChatError.fromResponse(res.status, parsed || t);
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

function buildStreamPayload(input: StreamChatInput): {
  page: { url?: string; title?: string };
  parts: ContentPart[];
} {
  const page = input.page || getPageContext();
  const shouldUseArticleContext =
    input.useArticleContext !== undefined ? input.useArticleContext : true;
  const articleSnippet = shouldUseArticleContext
    ? getArticleTextSnippet(4000)
    : null;

  const parts: ContentPart[] = [{ type: 'text', text: CHAT_STYLE_PROMPT }];

  if (input.ragContext) {
    const ragPrompt = buildRAGContextPrompt(input.ragContext);
    if (ragPrompt) parts.push({ type: 'text', text: ragPrompt });
  }

  if (input.memoryContext) {
    const memoryPrompt = buildMemoryContextPrompt(input.memoryContext);
    if (memoryPrompt) parts.push({ type: 'text', text: memoryPrompt });
  }

  const contextPrompt = buildContextPrompt(articleSnippet);
  if (contextPrompt) parts.push({ type: 'text', text: contextPrompt });

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

  return { page, parts };
}

async function* streamChatEventsWebSocket(input: {
  sessionId: string;
  parts: ContentPart[];
  page: { url?: string; title?: string };
  signal?: AbortSignal;
  onFirstToken?: (ms: number) => void;
}): AsyncGenerator<ChatStreamEvent, void, void> {
  const url = buildChatWebSocketUrl(input.sessionId);
  const ws = new WebSocket(url);
  const queue: ChatStreamEvent[] = [];
  let resolveQueue: (() => void) | null = null;
  let closed = false;
  let error: ChatError | null = null;

  const markFirst = createFirstTokenTracker(input.onFirstToken);

  const wake = () => {
    if (resolveQueue) {
      resolveQueue();
      resolveQueue = null;
    }
  };

  const push = (event: ChatStreamEvent) => {
    if (event.type === 'text') markFirst();
    queue.push(event);
    wake();
  };

  const finish = (err?: ChatError | null) => {
    if (closed) return;
    closed = true;
    error = err ?? null;
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'stream end');
      }
    } catch {
      // ignore close errors
    }
    wake();
  };

  const handleAbort = () => {
    finish(new ChatError('Request aborted', 'ABORTED'));
  };

  if (input.signal) {
    if (input.signal.aborted) {
      handleAbort();
    } else {
      input.signal.addEventListener('abort', handleAbort, { once: true });
    }
  }

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: 'message',
        sessionId: input.sessionId,
        parts: input.parts,
        context: { page: input.page },
      })
    );
  };

  ws.onmessage = (event) => {
    const raw = typeof event.data === 'string' ? event.data : '';
    if (!raw) return;

    try {
      const payload = JSON.parse(raw);

      if (payload?.type === 'session' && typeof payload.sessionId === 'string') {
        storeSessionId(payload.sessionId);
        return;
      }

      if (payload?.type === 'done') {
        push({ type: 'done' });
        finish();
        return;
      }

      if (payload?.type === 'error') {
        finish(new ChatError(payload.error || 'Chat failed', 'SERVER_ERROR'));
        return;
      }

      const events = parseStreamObject(payload);
      if (events.length === 0 && payload?.text) {
        push({ type: 'text', text: payload.text });
        return;
      }

      for (const evt of events) {
        push(evt);
      }
    } catch {
      // ignore malformed payloads
    }
  };

  ws.onerror = () => {
    finish(new ChatError('WebSocket error', 'NETWORK_ERROR'));
  };

  ws.onclose = () => {
    finish();
  };

  try {
    while (true) {
      if (queue.length > 0) {
        const next = queue.shift();
        if (next) {
          yield next;
          if (next.type === 'done') return;
          continue;
        }
      }

      if (closed) {
        if (error) throw error;
        return;
      }

      await new Promise<void>((resolve) => {
        resolveQueue = resolve;
      });
    }
  } finally {
    if (input.signal) {
      input.signal.removeEventListener('abort', handleAbort);
    }
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
    throw ChatError.fromResponse(res.status, parsed || text);
  }

  const data = parsed.data;
  if (!data || typeof data.url !== 'string') {
    throw new ChatError('Invalid chat image upload response', 'PARSE_ERROR');
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
    throw ChatError.fromResponse(res.status, parsed || text);
  }

  const data = parsed.data;
  const value =
    (data && typeof data.text === 'string' && data.text) ||
    (typeof data === 'string' ? data : null);

  if (!value) {
    throw new ChatError('Invalid chat aggregate response', 'PARSE_ERROR');
  }
  return value;
}
