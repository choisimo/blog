/**
 * Chat Service Types
 *
 * 타입 정의 모음
 */

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
  | 'catalyst'
  | 'sketch'
  | 'prism'
  | 'chain'
  | 'summary'
  | 'custom';

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
// Stream Types
// ============================================================================

export type ChatStreamEvent =
  | { type: 'text'; text: string }
  | {
      type: 'sources';
      sources: Array<{
        title?: string;
        url?: string;
        score?: number;
        snippet?: string;
      }>;
    }
  | { type: 'followups'; questions: string[] }
  | { type: 'context'; page?: { url?: string; title?: string } }
  | { type: 'done' };

export type StreamChatInput = {
  text: string;
  page?: { url?: string; title?: string };
  signal?: AbortSignal;
  onFirstToken?: (ms: number) => void;
  useArticleContext?: boolean;
  imageUrl?: string;
  imageAnalysis?: string | null;
  ragContext?: string | null; // RAG 검색 컨텍스트 (블로그 포스트)
  memoryContext?: string | null; // 사용자 메모리 컨텍스트
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
};

export type ContentPart = {
  type: 'text';
  text: string;
};
