/**
 * Chat Service - API Functions
 *
 * 채팅 관련 API 호출 함수들
 */

import { getApiBaseUrl } from "@/utils/network/apiBase";
import { bearerAuth } from "@/lib/auth";
import { getPrincipalToken } from "@/services/session/userContentAuth";
import {
  buildChatUrl,
  buildChatHeaders,
} from "./config";
import { ensureSession, storeSessionId } from "./session";
import {
  getPageContext,
  getArticleTextSnippet,
  CHAT_STYLE_PROMPT,
  buildContextPrompt,
  buildImageContext,
  buildRAGContextPrompt,
  buildMemoryContextPrompt,
} from "./context";
import {
  getParserForContentType,
  createFirstTokenTracker,
} from "./stream";
import type {
  ChatStreamEvent,
  StreamChatInput,
  InvokeChatTaskInput,
  InvokeChatTaskResult,
  LensFeedRequest,
  LensFeedResponse,
  ThoughtFeedRequest,
  ThoughtFeedResponse,
  ChatImageUploadResult,
  ContentPart
} from "./types";
import { ChatError } from "./types";

type ChatTaskEnvelope = {
  data?: unknown;
  result?: unknown;
  output?: unknown;
  payload?: unknown;
};

type ChatUploadEnvelope = {
  ok?: boolean;
  data?: ChatImageUploadResult;
};

type ChatAggregateEnvelope = {
  ok?: boolean;
  data?: string | { text?: string };
};

type ChatJsonRequestOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

type ChatJsonResponse<T> = {
  status: number;
  data: T | null;
  raw: unknown;
};

async function buildAuthenticatedChatHeaders(
  contentType: "json" | "stream",
  extraHeaders?: Record<string, string>,
): Promise<Record<string, string>> {
  const token = await getPrincipalToken();
  return {
    ...buildChatHeaders(contentType),
    ...bearerAuth(token),
    ...(extraHeaders ?? {}),
  };
}

export function createChatIdempotencyKey(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getAggregateText(data: ChatAggregateEnvelope["data"]): string | null {
  if (typeof data === "string") {
    return data;
  }
  if (
    data &&
    typeof data === "object" &&
    "text" in data &&
    typeof data.text === "string"
  ) {
    return data.text;
  }
  return null;
}

function getEnvelopeData(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;

  const envelope = parsed as ChatTaskEnvelope;
  return (
    envelope.data ??
    envelope.result ??
    envelope.output ??
    envelope.payload ??
    parsed
  );
}

async function postSessionJson<T>(
  path: string,
  sessionId: string,
  body: unknown,
  options?: ChatJsonRequestOptions,
): Promise<ChatJsonResponse<T>> {
  const url = buildChatUrl(path, sessionId);
  const headers = await buildAuthenticatedChatHeaders("json", options?.headers);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  const text = await res.text().catch(() => "");
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

  const dataCandidate = getEnvelopeData(parsed);

  return {
    status: res.status,
    data: (dataCandidate as T) ?? null,
    raw: parsed,
  };
}

// ============================================================================
// Chat Task API
// ============================================================================

/**
 * AI 태스크 실행 (sketch, prism, chain 등)
 */
export async function invokeChatTask<T = unknown>(
  input: InvokeChatTaskInput,
): Promise<InvokeChatTaskResult<T>> {
  const sessionID = await ensureSession();
  const body = {
    mode: input.mode,
    prompt: input.prompt ?? "",
    payload: input.payload ?? {},
    context: input.context ?? getPageContext(),
  };
  const response = await postSessionJson<T>("/task", sessionID, body, {
    signal: input.signal,
    headers: input.headers,
  });

  return {
    ok: true,
    status: response.status,
    data: response.data,
    raw: response.raw,
  };
}

export async function invokeLensFeed(
  input: LensFeedRequest,
  options?: ChatJsonRequestOptions,
): Promise<LensFeedResponse> {
  const sessionID = await ensureSession();
  const response = await postSessionJson<LensFeedResponse>(
    "/lens-feed",
    sessionID,
    {
      ...input,
      context: getPageContext(),
    },
    options,
  );

  if (response.data == null) {
    throw new ChatError("Invalid lens feed response", "PARSE_ERROR");
  }

  return response.data;
}

export async function invokeThoughtFeed(
  input: ThoughtFeedRequest,
  options?: ChatJsonRequestOptions,
): Promise<ThoughtFeedResponse> {
  const sessionID = await ensureSession();
  const response = await postSessionJson<ThoughtFeedResponse>(
    "/thought-feed",
    sessionID,
    {
      ...input,
      context: getPageContext(),
    },
    options,
  );

  if (response.data == null) {
    throw new ChatError("Invalid thought feed response", "PARSE_ERROR");
  }

  return response.data;
}

// ============================================================================
// Chat Streaming API
// ============================================================================

/**
 * 채팅 메시지 스트리밍
 */
export async function* streamChatEvents(
  input: StreamChatInput,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const sessionID = await ensureSession();
  const { page, parts, enableRag } = buildStreamPayload(input);

  const url = buildChatUrl("/message", sessionID);
  const idempotencyKey = input.idempotencyKey || createChatIdempotencyKey();
  const headers = await buildAuthenticatedChatHeaders("stream", {
    "Idempotency-Key": idempotencyKey,
  });

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      parts,
      context: { page },
      enableRag,
    }),
    signal: input.signal,
  });

  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(t);
    } catch {
      void 0;
    }
    throw ChatError.fromResponse(res.status, parsed || t);
  }

  // 스트림 파싱
  const contentType = res.headers.get("content-type") || "";
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
        if (event.type === "session") {
          storeSessionId(event.sessionId);
        }
        if (event.type === "error") {
          throw new ChatError(event.message || "Chat failed", "SERVER_ERROR");
        }
        if (event.type === "text") markFirst();
        yield event;
      }
    }

    // 남은 버퍼 처리
    const finalEvents = parser.flush();
    for (const event of finalEvents) {
      if (event.type === "session") {
        storeSessionId(event.sessionId);
      }
      if (event.type === "error") {
        throw new ChatError(event.message || "Chat failed", "SERVER_ERROR");
      }
      if (event.type === "text") markFirst();
      yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

function buildStreamPayload(input: StreamChatInput): {
  page: { url?: string; title?: string };
  parts: ContentPart[];
  enableRag: boolean;
} {
  const domPage = input.page || getPageContext();
  const page: ReturnType<typeof getPageContext> = input.currentPost
    ? { ...domPage, article: input.currentPost }
    : domPage;

  const shouldUseArticleContext =
    input.useArticleContext !== undefined ? input.useArticleContext : true;
  const articleSnippet = shouldUseArticleContext
    ? getArticleTextSnippet(4000)
    : null;

  const parts: ContentPart[] = [
    { type: "text", purpose: "system", text: CHAT_STYLE_PROMPT },
  ];

  if (input.ragContext) {
    const ragPrompt = buildRAGContextPrompt(input.ragContext);
    if (ragPrompt)
      parts.push({ type: "text", purpose: "context", text: ragPrompt });
  }

  if (input.memoryContext) {
    const memoryPrompt = buildMemoryContextPrompt(input.memoryContext);
    if (memoryPrompt)
      parts.push({ type: "text", purpose: "context", text: memoryPrompt });
  }

  const contextPrompt = buildContextPrompt(articleSnippet, page);
  if (contextPrompt)
    parts.push({ type: "text", purpose: "context", text: contextPrompt });

  if (Array.isArray(input.selectedBlockAttachments)) {
    for (const attachment of input.selectedBlockAttachments) {
      parts.push({ type: "selected-block", attachment });
    }
  }

  if (input.imageUrl) {
    const imageContext = buildImageContext(
      input.imageUrl,
      input.imageAnalysis,
      "",
    );
    parts.push({ type: "text", text: imageContext });
    parts.push({
      type: "text",
      purpose: "user",
      text: input.text || "이 이미지에 대해 설명해 주세요.",
    });
  } else {
    parts.push({ type: "text", purpose: "user", text: input.text });
  }

  return { page, parts, enableRag: input.enableRag ?? false };
}

/**
 * 간단한 텍스트 전용 스트리밍
 */
export async function* streamChatMessage(input: {
  text: string;
}): AsyncGenerator<string, void, void> {
  for await (const ev of streamChatEvents({ text: input.text })) {
    if (ev.type === "text") yield ev.text;
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
  signal?: AbortSignal,
): Promise<ChatImageUploadResult> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, "")}/api/v1/images/chat-upload`;
  const formData = new FormData();
  formData.append("file", file);
  const token = await getPrincipalToken();

  if (process.env.NODE_ENV === "development") {
    console.log("[ChatImage] Uploading to:", url);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: bearerAuth(token),
    body: formData,
    signal,
  });

  const text = await res.text().catch(() => "");
  let parsed: ChatUploadEnvelope | null = null;
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

  const data = parsed?.data;
  if (!data || typeof data.url !== "string") {
    throw new ChatError("Invalid chat image upload response", "PARSE_ERROR");
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      "[ChatImage] Upload success, analysis:",
      data.imageAnalysis ? "OK" : "NULL",
    );
  }

  return data;
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
  const url = `${base.replace(/\/$/, "")}/api/v1/chat/aggregate`;
  const headers = await buildAuthenticatedChatHeaders("json");

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt: input.prompt }),
    signal: input.signal,
  });

  const text = await res.text().catch(() => "");
  let parsed: ChatAggregateEnvelope | null = null;
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

  const value = getAggregateText(parsed?.data);

  if (!value) {
    throw new ChatError("Invalid chat aggregate response", "PARSE_ERROR");
  }
  return value;
}
