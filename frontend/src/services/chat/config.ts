import { getApiBaseUrl } from '@/utils/network/apiBase';

type ChatWindow = Window & {
  APP_CONFIG?: {
    chatBaseUrl?: string;
    chatApiKey?: string;
    chatWsBaseUrl?: string;
    capabilities?: {
      supportsChatWebSocket?: boolean;
    };
    aiUnified?: unknown;
  };
  __APP_CONFIG?: {
    chatBaseUrl?: string;
    chatApiKey?: string;
    chatWsBaseUrl?: string;
    capabilities?: {
      supportsChatWebSocket?: boolean;
    };
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
  if (typeof window !== 'undefined') {
    try {
      const override = localStorage.getItem('aiMemo.chatWsBaseUrl');
      if (override) {
        const parsed = JSON.parse(override) as unknown;
        if (typeof parsed === 'string' && parsed) return parsed;
      }
    } catch { void 0; }
  }

  const w = getChatWindow();
  const runtime = w?.APP_CONFIG?.chatWsBaseUrl ?? w?.__APP_CONFIG?.chatWsBaseUrl;
  if (typeof runtime === 'string' && runtime) return runtime;

  const env = import.meta.env.VITE_CHAT_WS_URL as string | undefined;
  if (typeof env === 'string' && env) return env;

  return null;
}

function getChatWebSocketCapability(): boolean | null {
  const w = getChatWindow();
  const runtime =
    w?.APP_CONFIG?.capabilities?.supportsChatWebSocket ??
    w?.__APP_CONFIG?.capabilities?.supportsChatWebSocket;
  if (typeof runtime === 'boolean') return runtime;

  const env = import.meta.env.VITE_CHAT_WS_ENABLED as string | boolean | undefined;
  if (typeof env === 'boolean') return env;
  if (typeof env === 'string' && env) {
    return env === 'true';
  }

  return null;
}

export function shouldUseChatWebSocket(): boolean {
  const capability = getChatWebSocketCapability();
  if (capability === false) return false;
  if (getChatWebSocketBaseUrl()) return true;
  try {
    const base = getChatBaseUrl();
    const url = new URL(base);
    return ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
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
  const capability = getChatWebSocketCapability();
  if (capability === false) {
    throw new Error('Chat WebSocket capability is disabled');
  }

  const overrideBase = getChatWebSocketBaseUrl();
  if (!overrideBase && !shouldUseChatWebSocket()) {
    throw new Error('Chat WebSocket capability is disabled');
  }
  const base = (overrideBase || getChatBaseUrl()).replace(/\/$/, '');
  const wsBase = base.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
  const url = new URL(`${wsBase}/api/v1/chat/ws`);
  if (sessionId) url.searchParams.set('sessionId', sessionId);
  return url.toString();
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
