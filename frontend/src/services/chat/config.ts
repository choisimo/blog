import { getApiBaseUrl } from '@/utils/network/apiBase';

type ChatWindow = Window & {
  APP_CONFIG?: {
    chatBaseUrl?: string;
    aiUnified?: unknown;
  };
  __APP_CONFIG?: {
    chatBaseUrl?: string;
    aiUnified?: unknown;
  };
};

function getChatWindow(): ChatWindow | null {
  return typeof window !== 'undefined' ? (window as ChatWindow) : null;
}

function normalizeConfigString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || /[\r\n]/.test(normalized) || /%(?:0a|0d)/i.test(normalized)) return null;
  return normalized;
}

function hasExplicitOrigin(value: string): boolean {
  return /^[a-z][a-z\d+\-.]*:/i.test(value) || value.startsWith('//');
}

export function normalizeChatBaseUrl(value: unknown): string | null {
  const normalized = normalizeConfigString(value);
  if (!normalized) return null;

  if (normalized.startsWith('/') && !normalized.startsWith('//')) {
    return normalized.replace(/\/+$/, '');
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    if (parsed.search || parsed.hash) {
      return null;
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function normalizeChatPath(path: string): string {
  const normalized = normalizeConfigString(path);
  if (
    !normalized ||
    hasExplicitOrigin(normalized) ||
    normalized.startsWith('//') ||
    normalized.includes('/../') ||
    normalized.endsWith('/..')
  ) {
    throw new Error('Invalid chat path');
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function normalizeChatSessionId(sessionId: string | undefined): string | null {
  if (sessionId === undefined) return null;

  const normalized = normalizeConfigString(sessionId);
  if (!normalized || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized)) {
    throw new Error('Invalid chat session id');
  }

  return normalized;
}

export function getChatBaseUrl(): string {
  const w = getChatWindow();
  const runtime = w?.APP_CONFIG?.chatBaseUrl ?? w?.__APP_CONFIG?.chatBaseUrl;
  const runtimeBaseUrl = normalizeChatBaseUrl(runtime);
  if (runtimeBaseUrl) return runtimeBaseUrl;

  const env = import.meta.env.VITE_CHAT_BASE_URL as string | undefined;
  const envBaseUrl = normalizeChatBaseUrl(env);
  if (envBaseUrl) return envBaseUrl;

  return normalizeChatBaseUrl(getApiBaseUrl()) ?? getApiBaseUrl();
}

export function getChatWebSocketBaseUrl(): string | null {
  return null;
}

export function shouldUseChatWebSocket(): boolean {
  return false;
}

export function getBooleanFromUnknown(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    return lowered === '1' || lowered === 'true' || lowered === 'yes' || lowered === 'on';
  }
  return false;
}

export function isUnifiedTasksEnabled(): boolean {
  const w = getChatWindow();
  const runtimeFlag = w?.APP_CONFIG?.aiUnified ?? w?.__APP_CONFIG?.aiUnified ?? undefined;
  if (runtimeFlag !== undefined) return getBooleanFromUnknown(runtimeFlag);

  const envFlag = import.meta.env.VITE_AI_UNIFIED as string | boolean | undefined;
  return getBooleanFromUnknown(envFlag);
}

export function buildChatUrl(path: string, sessionId?: string): string {
  const apiBase = getChatBaseUrl().replace(/\/+$/, '');
  const chatPath = normalizeChatPath(path);
  const chatSessionId = normalizeChatSessionId(sessionId);
  return chatSessionId
    ? `${apiBase}/api/v1/chat/session/${encodeURIComponent(chatSessionId)}${chatPath}`
    : `${apiBase}/api/v1/chat${chatPath}`;
}

export function buildChatWebSocketUrl(sessionId?: string): string {
  void sessionId;
  throw new Error('Chat WebSocket transport has been removed; use SSE streaming instead');
}

export function buildChatHeaders(
  contentType: 'json' | 'stream' = 'json'
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (contentType === 'stream') {
    headers['Accept'] = 'text/event-stream, application/x-ndjson, text/plain';
  } else {
    headers['Accept'] = 'application/json, text/plain';
  }

  return headers;
}
