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

const MAX_CHAT_HEADER_VALUE_LENGTH = 1024;
const MAX_CHAT_IMAGE_FIELD_LENGTH = 512;
const MAX_CHAT_PROMPT_LENGTH = 20000;
const CHAT_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CHAT_IMAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;

function normalizeHeaderSafeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || /[\r\n]/.test(normalized) || /%(?:0a|0d)/i.test(normalized)) return null;
  return normalized;
}

function normalizeBoundedHeaderValue(value: unknown): string | null {
  const normalized = normalizeHeaderSafeString(value);
  return normalized && normalized.length <= MAX_CHAT_HEADER_VALUE_LENGTH
    ? normalized
    : null;
}

export function normalizeChatMultilineText(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new ChatError(`Invalid chat ${label}`, "VALIDATION_ERROR");
  }

  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized || normalized.length > MAX_CHAT_PROMPT_LENGTH) {
    throw new ChatError(`Invalid chat ${label}`, "VALIDATION_ERROR");
  }

  return normalized;
}

function normalizeChatIdempotencyKey(value: unknown): string | null {
  const normalized = normalizeHeaderSafeString(value);
  return normalized && CHAT_IDEMPOTENCY_KEY_PATTERN.test(normalized)
    ? normalized
    : null;
}

function normalizeChatImageUrl(value: unknown): string | null {
  const normalized = normalizeHeaderSafeString(value);
  if (!normalized || normalized.length > MAX_CHAT_IMAGE_FIELD_LENGTH) return null;

  if (normalized.startsWith("/")) {
    return normalized.startsWith("//") || normalized.includes("/../") ? null : normalized;
  }

  try {
    const parsed = new URL(normalized);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeChatImageKey(value: unknown): string | null {
  const normalized = normalizeHeaderSafeString(value);
  if (
    !normalized ||
    normalized.length > MAX_CHAT_IMAGE_FIELD_LENGTH ||
    !CHAT_IMAGE_KEY_PATTERN.test(normalized) ||
    normalized.includes("//") ||
    normalized.includes("/../") ||
    normalized.endsWith("/..")
  ) {
    return null;
  }
  return normalized;
}

function normalizeExtraChatHeaders(headers?: Record<string, string>): Record<string, string> {
  if (!headers) return {};

  return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    const normalizedKey = normalizeHeaderSafeString(key);
    const normalizedValue = normalizeBoundedHeaderValue(value);
    if (!normalizedKey || !normalizedValue || normalizedKey.toLowerCase() === "authorization") {
      return acc;
    }
    acc[normalizedKey] = normalizedValue;
    return acc;
  }, {});
}

function isValidChatUploadFile(file: File): boolean {
  if (!file || typeof file !== "object") return false;
  const candidate = file as {
    name?: unknown;
    size?: unknown;
    type?: unknown;
  };
  const name = normalizeHeaderSafeString(candidate.name);
  const type = normalizeHeaderSafeString(candidate.type);
  return (
    Boolean(name) &&
    Boolean(type?.startsWith("image/")) &&
    typeof candidate.size === "number" &&
    Number.isSafeInteger(candidate.size) &&
    candidate.size > 0
  );
}

function normalizeChatUploadResult(
  data: ChatUploadEnvelope["data"],
): ChatImageUploadResult | null {
  if (!data || typeof data !== "object") return null;

  const url = normalizeChatImageUrl(data.url);
  const key = normalizeChatImageKey(data.key);
  const contentType = normalizeHeaderSafeString(data.contentType);
  if (
    !url ||
    !key ||
    !contentType?.startsWith("image/") ||
    typeof data.size !== "number" ||
    !Number.isSafeInteger(data.size) ||
    data.size <= 0
  ) {
    return null;
  }

  return {
    ...data,
    url,
    key,
    size: data.size,
    contentType,
  };
}

async function buildAuthenticatedChatHeaders(
  contentType: "json" | "stream",
  extraHeaders?: Record<string, string>,
): Promise<Record<string, string>> {
  const token = await getPrincipalToken();
  return {
    ...buildChatHeaders(contentType),
    ...normalizeExtraChatHeaders(extraHeaders),
    ...bearerAuth(token),
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
  const idempotencyKey = input.idempotencyKey
    ? normalizeChatIdempotencyKey(input.idempotencyKey)
    : createChatIdempotencyKey();
  if (!idempotencyKey) {
    throw new ChatError("Invalid chat idempotency key", "VALIDATION_ERROR");
  }
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
    const userText = normalizeChatMultilineText(
      input.text || "이 이미지에 대해 설명해 주세요.",
      "message",
    );
    const imageContext = buildImageContext(
      input.imageUrl,
      input.imageAnalysis,
      "",
    );
    parts.push({ type: "text", text: imageContext });
    parts.push({
      type: "text",
      purpose: "user",
      text: userText,
    });
  } else {
    parts.push({
      type: "text",
      purpose: "user",
      text: normalizeChatMultilineText(input.text, "message"),
    });
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
  if (!isValidChatUploadFile(file)) {
    throw new ChatError("Invalid chat image file", "VALIDATION_ERROR");
  }

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

  const data = normalizeChatUploadResult(parsed?.data);
  if (!data) {
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
  const prompt = normalizeChatMultilineText(input.prompt, "aggregate prompt");
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, "")}/api/v1/chat/aggregate`;
  const headers = await buildAuthenticatedChatHeaders("json");

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt }),
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
