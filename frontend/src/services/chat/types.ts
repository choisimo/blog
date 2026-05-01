/**
 * Chat Service Types
 *
 * 타입 정의 모음
 */

// ============================================================================
// Error Types
// ============================================================================

export type ChatErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "ABORTED"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "VALIDATION_ERROR"
  | "PARSE_ERROR"
  | "UNKNOWN";

export class ChatError extends Error {
  readonly code: ChatErrorCode;
  readonly status?: number;
  readonly response?: unknown;
  readonly isRetryable: boolean;
  readonly originalCause?: unknown;

  constructor(
    message: string,
    code: ChatErrorCode,
    options?: { status?: number; response?: unknown; cause?: unknown },
  ) {
    super(message);
    this.name = "ChatError";
    this.code = code;
    this.status = options?.status;
    this.response = options?.response;
    this.originalCause = options?.cause;
    this.isRetryable = [
      "NETWORK_ERROR",
      "TIMEOUT",
      "SERVER_ERROR",
      "RATE_LIMITED",
    ].includes(code);
  }

  static fromResponse(status: number, body?: unknown): ChatError {
    const message = extractErrorMessage(body) || `HTTP ${status}`;

    if (status === 401 || status === 403) {
      return new ChatError(message, "UNAUTHORIZED", { status, response: body });
    }
    if (status === 429) {
      return new ChatError(message, "RATE_LIMITED", { status, response: body });
    }
    if (status >= 400 && status < 500) {
      return new ChatError(message, "VALIDATION_ERROR", {
        status,
        response: body,
      });
    }
    if (status >= 500) {
      return new ChatError(message, "SERVER_ERROR", { status, response: body });
    }
    return new ChatError(message, "UNKNOWN", { status, response: body });
  }

  static fromNetworkError(error: unknown): ChatError {
    if (error instanceof DOMException && error.name === "AbortError") {
      return new ChatError("Request aborted", "ABORTED", { cause: error });
    }
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return new ChatError("Network request failed", "NETWORK_ERROR", {
        cause: error,
      });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return new ChatError(message, "UNKNOWN", { cause: error });
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.error === "string") return obj.error;
  if (typeof obj.message === "string") return obj.message;
  if (obj.error && typeof obj.error === "object") {
    const err = obj.error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
  }
  return null;
}

// ============================================================================
// Session Types
// ============================================================================

export type ChatSession = {
  sessionID: string;
};

// ============================================================================
// Task Types
// ============================================================================

export type ChatTaskMode =
  | "catalyst"
  | "sketch"
  | "prism"
  | "chain"
  | "summary"
  | "quiz"
  | "custom";

export type InvokeChatTaskInput = {
  mode: ChatTaskMode;
  prompt?: string;
  payload?: Record<string, unknown>;
  context?: { url?: string; title?: string };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export type InvokeChatTaskResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  raw: unknown;
};

// ============================================================================
// Feed Types
// ============================================================================

export type FeedCursor = {
  seed: string;
  page: number;
  seenKeys: string[];
};

export type FeedItemState = {
  logicalKey: string;
  itemHash?: string;
  unread?: boolean;
  changed?: boolean;
};

export type LensCard = {
  id: string;
  personaId: "mentor" | "debater" | "explorer" | "analyst";
  angleKey: string;
  title: string;
  summary: string;
  bullets: string[];
  detail: string;
  tags: string[];
};

export type ThoughtCard = {
  id: string;
  trackKey: string;
  title: string;
  subtitle?: string;
  body: string;
  bullets?: string[];
  tags?: string[];
};

export type LensFeedRequest = {
  paragraph: string;
  postTitle?: string;
  cursor?: FeedCursor | null;
  count?: number;
};

export type FeedResponseSource =
  | "snapshot"
  | "snapshot-stale"
  | "warming"
  | "warming-fallback";

export type LensFeedResponse = {
  items: LensCard[];
  nextCursor: FeedCursor | null;
  exhausted: boolean;
  warming?: boolean;
  stale?: boolean;
  source?: FeedResponseSource;
  snapshotId?: string;
  generationVersionHash?: string;
  unreadCount?: number;
  itemStates?: FeedItemState[];
};

export type ThoughtFeedRequest = {
  paragraph: string;
  postTitle?: string;
  cursor?: FeedCursor | null;
  count?: number;
};

export type ThoughtFeedResponse = {
  items: ThoughtCard[];
  nextCursor: FeedCursor | null;
  exhausted: boolean;
  warming?: boolean;
  stale?: boolean;
  source?: FeedResponseSource;
  snapshotId?: string;
  generationVersionHash?: string;
  unreadCount?: number;
  itemStates?: FeedItemState[];
};

// ============================================================================
// Stream Types
// ============================================================================

export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "session"; sessionId: string }
  | {
      type: "sources";
      sources: Array<{
        title?: string;
        url?: string;
        score?: number;
        snippet?: string;
      }>;
    }
  | { type: "followups"; questions: string[] }
  | { type: "context"; page?: { url?: string; title?: string } }
  | { type: "error"; message: string; code?: string }
  | { type: "done" };

export type StreamChatInput = {
  text: string;
  page?: { url?: string; title?: string };
  currentPost?: PageContext["article"];
  signal?: AbortSignal;
  idempotencyKey?: string;
  onFirstToken?: (ms: number) => void;
  useArticleContext?: boolean;
  imageUrl?: string;
  imageAnalysis?: string | null;
  ragContext?: string | null;
  memoryContext?: string | null;
  enableRag?: boolean;
  selectedBlockAttachments?: SelectedBlockAttachment[];
};

// ============================================================================
// Image Upload Types
// ============================================================================

export type ChatImageUploadResult = {
  url: string;
  key: string;
  size: number;
  contentType: string;
  imageAnalysis?: string | null;
};

// ============================================================================
// Context Types
// ============================================================================

export type PageContext = {
  url?: string;
  title?: string;
  article?: {
    title?: string;
    slug?: string;
    year?: string;
    description?: string;
    headings?: string[];
  };
};

export type SelectedBlockAttachment = {
  kind: "selected-block";
  id: string;
  name: string;
  contentType: "text/markdown";
  markdown: string;
  textPreview: string;
  sizeBytes: number;
  truncated?: boolean;
  persistRaw?: false;
  source?: {
    url?: string;
    title?: string;
    year?: string;
    slug?: string;
  };
};

export type TextContentPart = {
  type: "text";
  text: string;
  purpose?: "system" | "context" | "user";
};

export type SelectedBlockContentPart = {
  type: "selected-block";
  attachment: SelectedBlockAttachment;
};

export type ContentPart = TextContentPart | SelectedBlockContentPart;
