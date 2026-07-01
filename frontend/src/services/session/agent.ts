import { adminFetchRaw } from '@/services/admin/apiClient';
import { getApiBaseUrl } from '@/utils/network/apiBase';

export type AgentEditorAction =
  | { type: 'set_title'; value?: string; title?: string }
  | { type: 'set_slug'; value?: string; slug?: string }
  | { type: 'set_category'; value?: string; category?: string }
  | { type: 'set_tags'; value?: string | string[]; tags?: string | string[] }
  | { type: 'set_cover_image'; url?: string; value?: string }
  | { type: 'insert_markdown'; markdown?: string; content?: string; text?: string }
  | { type: 'replace_content'; content?: string; markdown?: string }
  | { type: 'append_content'; markdown?: string; content?: string; text?: string };

export type AgentRunResponse = {
  response: string;
  actions?: AgentEditorAction[];
  sessionId: string;
  toolsUsed: string[];
  memoryUpdated: boolean;
  model?: string;
  tokens?: unknown;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as { error?: unknown; message?: unknown };
  if (typeof record.error === 'string') return record.error;
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as { message?: unknown; code?: unknown };
    if (typeof nested.message === 'string') return nested.message;
    if (typeof nested.code === 'string') return nested.code;
  }
  if (typeof record.message === 'string') return record.message;
  return fallback;
}

function createIdempotencyKey(): string {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `agent-run:${randomId}`;
}

export async function runBlogAgent(
  payload: {
    message: string;
    sessionId: string;
    maxIterations?: number;
    temperature?: number;
  },
  _token?: string,
): Promise<AgentRunResponse> {
  const base = getApiBaseUrl();
  const response = await adminFetchRaw(`${base}/api/v1/agent/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': createIdempotencyKey(),
    },
    body: JSON.stringify({
      message: payload.message,
      sessionId: payload.sessionId,
      mode: 'blog',
      maxIterations: payload.maxIterations ?? 6,
      temperature: payload.temperature ?? 0.4,
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) {
    throw new Error(getErrorMessage(json, 'AI agent request failed'));
  }
  return json.data as AgentRunResponse;
}
