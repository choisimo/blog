import { getApiBaseUrl } from '@/utils/network/apiBase';

type ChatWindow = Window & {
  APP_CONFIG?: {
    chatBaseUrl?: string;
    chatApiKey?: string;
    aiUnified?: unknown;
  };
  __APP_CONFIG?: {
    chatBaseUrl?: string;
    chatApiKey?: string;
    aiUnified?: unknown;
  };
};

function getChatWindow(): ChatWindow | null {
  return typeof window !== 'undefined' ? (window as ChatWindow) : null;
}

export function getChatBaseUrl(): string {
  const w = getChatWindow();
  const runtime = w?.APP_CONFIG?.chatBaseUrl ?? w?.__APP_CONFIG?.chatBaseUrl;
  if (typeof runtime === 'string' && runtime) return runtime;

  const env = import.meta.env.VITE_CHAT_BASE_URL as string | undefined;
  if (typeof env === 'string' && env) return env;

  return getApiBaseUrl();
}

export function getChatApiKey(): string | null {
  const w = getChatWindow();
  const runtime = w?.APP_CONFIG?.chatApiKey ?? w?.__APP_CONFIG?.chatApiKey;
  if (typeof runtime === 'string' && runtime) return runtime;

  const env = import.meta.env.VITE_CHAT_API_KEY as string | undefined;
  if (typeof env === 'string' && env) return env;

  return null;
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
  const apiBase = getChatBaseUrl().replace(/\/$/, '');
  return sessionId
    ? `${apiBase}/api/v1/chat/session/${encodeURIComponent(sessionId)}${path}`
    : `${apiBase}/api/v1/chat${path}`;
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
