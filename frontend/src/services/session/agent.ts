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

const MAX_AGENT_MESSAGE_LENGTH = 20000;
const MAX_AGENT_RESPONSE_LENGTH = 20000;
const MAX_AGENT_MARKDOWN_LENGTH = 200000;
const MAX_AGENT_SINGLE_LINE_LENGTH = 500;
const MAX_AGENT_TAGS = 25;
const MAX_AGENT_ITERATIONS = 12;
const MAX_AGENT_TOKEN_METADATA_DEPTH = 4;
const MAX_AGENT_TOKEN_METADATA_ARRAY_ITEMS = 25;
const MAX_AGENT_TOKEN_METADATA_OBJECT_KEYS = 25;
const AGENT_SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const AGENT_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const AGENT_IMAGE_PATH_PATTERN = /^\/images\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|gif|avif)$/i;
const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const MULTILINE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const WHITESPACE_PATTERN = /\s+/g;
const AGENT_ACTION_TYPES = new Set<AgentEditorAction['type']>([
  'set_title',
  'set_slug',
  'set_category',
  'set_tags',
  'set_cover_image',
  'insert_markdown',
  'replace_content',
  'append_content',
]);

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as { error?: unknown; message?: unknown };
  const errorText = normalizeSingleLineText(record.error, 1000);
  if (errorText) return errorText;
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as { message?: unknown; code?: unknown };
    const nestedMessage = normalizeSingleLineText(nested.message, 1000);
    if (nestedMessage) return nestedMessage;
    const nestedCode = normalizeSingleLineText(nested.code, 1000);
    if (nestedCode) return nestedCode;
  }
  return normalizeSingleLineText(record.message, 1000) ?? fallback;
}

function createIdempotencyKey(): string {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `agent-run:${randomId}`;
}

function normalizeSingleLineText(value: unknown, maxLength = MAX_AGENT_SINGLE_LINE_LENGTH): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value
    .replace(SINGLE_LINE_CONTROL_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();
  if (!normalized || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

function normalizeMultilineText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(MULTILINE_CONTROL_PATTERN, ' ')
    .trim();
  if (!normalized || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

function normalizeSessionId(value: unknown): string | null {
  const normalized = normalizeSingleLineText(value, 128);
  return normalized && AGENT_SESSION_ID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeSlug(value: unknown): string | null {
  const normalized = normalizeSingleLineText(value, 128);
  return normalized && AGENT_SLUG_PATTERN.test(normalized) ? normalized : null;
}

function normalizeImagePath(value: unknown): string | null {
  const normalized = normalizeSingleLineText(value, 512);
  return normalized && AGENT_IMAGE_PATH_PATTERN.test(normalized) && !normalized.includes('/../')
    ? normalized
    : null;
}

function normalizeAgentTags(value: unknown): string[] | null {
  const rawTags = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : null;
  if (!rawTags) return null;

  const tags = rawTags
    .slice(0, MAX_AGENT_TAGS)
    .map(tag => normalizeSingleLineText(tag, 64))
    .filter((tag): tag is string => Boolean(tag));

  return tags.length > 0 ? tags : null;
}

function normalizeAgentAction(value: unknown): AgentEditorAction | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as AgentEditorAction;
  if (!AGENT_ACTION_TYPES.has(record.type)) return null;

  if (record.type === 'set_title') {
    const title = normalizeSingleLineText(record.value ?? record.title);
    return title ? { type: 'set_title', value: title } : null;
  }
  if (record.type === 'set_slug') {
    const slug = normalizeSlug(record.value ?? record.slug);
    return slug ? { type: 'set_slug', value: slug } : null;
  }
  if (record.type === 'set_category') {
    const category = normalizeSingleLineText(record.value ?? record.category);
    return category ? { type: 'set_category', value: category } : null;
  }
  if (record.type === 'set_tags') {
    const tags = normalizeAgentTags(record.value ?? record.tags);
    return tags ? { type: 'set_tags', tags } : null;
  }
  if (record.type === 'set_cover_image') {
    const url = normalizeImagePath(record.url ?? record.value);
    return url ? { type: 'set_cover_image', url } : null;
  }

  const markdown = normalizeMultilineText(
    record.type === 'replace_content'
      ? (record.content ?? record.markdown)
      : (record.markdown ?? record.content ?? record.text),
    MAX_AGENT_MARKDOWN_LENGTH,
  );
  return markdown ? { type: record.type, markdown } : null;
}

function normalizeTokenMetadata(value: unknown, depth = 0): unknown {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return normalizeSingleLineText(value, 1000) ?? undefined;
  if (depth >= MAX_AGENT_TOKEN_METADATA_DEPTH) return undefined;

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_AGENT_TOKEN_METADATA_ARRAY_ITEMS)
      .map(item => normalizeTokenMetadata(item, depth + 1))
      .filter(item => item !== undefined);
    return items.length > 0 ? items : undefined;
  }

  if (typeof value === 'object') {
    const normalizedEntries = Object.entries(value as Record<string, unknown>)
      .slice(0, MAX_AGENT_TOKEN_METADATA_OBJECT_KEYS)
      .flatMap(([key, item]) => {
        const safeKey = normalizeSingleLineText(key, 128);
        const safeValue = normalizeTokenMetadata(item, depth + 1);
        return safeKey && safeValue !== undefined ? [[safeKey, safeValue] as const] : [];
      });
    return normalizedEntries.length > 0
      ? Object.fromEntries(normalizedEntries)
      : undefined;
  }

  return undefined;
}

function normalizeAgentRunResponse(value: unknown): AgentRunResponse | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as AgentRunResponse;
  const response = normalizeMultilineText(record.response, MAX_AGENT_RESPONSE_LENGTH);
  const sessionId = normalizeSessionId(record.sessionId);
  if (!response || !sessionId || typeof record.memoryUpdated !== 'boolean') return null;
  if (!Array.isArray(record.toolsUsed)) return null;

  const toolsUsed = record.toolsUsed.map(tool => normalizeSingleLineText(tool, 128));
  if (toolsUsed.some(tool => tool === null)) return null;

  let actions: AgentEditorAction[] | undefined;
  if (record.actions !== undefined) {
    if (!Array.isArray(record.actions)) return null;
    const normalizedActions = record.actions.map(normalizeAgentAction);
    if (normalizedActions.some(action => action === null)) return null;
    actions = normalizedActions.filter((action): action is AgentEditorAction => action !== null);
  }

  const model = normalizeSingleLineText(record.model, 128) ?? undefined;
  const tokens = normalizeTokenMetadata(record.tokens);
  return {
    response,
    ...(actions ? { actions } : {}),
    sessionId,
    toolsUsed: toolsUsed as string[],
    memoryUpdated: record.memoryUpdated,
    ...(model ? { model } : {}),
    ...(tokens !== undefined ? { tokens } : {}),
  };
}

function normalizeAgentRunPayload(payload: {
  message: string;
  sessionId: string;
  maxIterations?: number;
  temperature?: number;
}) {
  const message = normalizeMultilineText(payload.message, MAX_AGENT_MESSAGE_LENGTH);
  const sessionId = normalizeSessionId(payload.sessionId);
  if (!message) throw new Error('Invalid AI agent message');
  if (!sessionId) throw new Error('Invalid AI agent session id');

  const maxIterations = payload.maxIterations ?? 6;
  const temperature = payload.temperature ?? 0.4;
  if (!Number.isFinite(maxIterations)) throw new Error('Invalid AI agent max iterations');
  if (!Number.isFinite(temperature)) throw new Error('Invalid AI agent temperature');

  return {
    message,
    sessionId,
    mode: 'blog',
    maxIterations: Math.min(MAX_AGENT_ITERATIONS, Math.max(1, Math.floor(maxIterations))),
    temperature: Math.min(2, Math.max(0, temperature)),
  };
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
  const normalizedPayload = normalizeAgentRunPayload(payload);
  const base = getApiBaseUrl();
  const response = await adminFetchRaw(`${base}/api/v1/agent/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': createIdempotencyKey(),
    },
    body: JSON.stringify(normalizedPayload),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) {
    throw new Error(getErrorMessage(json, 'AI agent request failed'));
  }
  const data = normalizeAgentRunResponse(json.data);
  if (!data) {
    throw new Error('AI agent returned an invalid response');
  }
  return data;
}
