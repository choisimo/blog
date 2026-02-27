/**
 * Chat Service Configuration
 *
 * 런타임/환경 설정 관련 유틸리티
 */

import { getApiBaseUrl } from '@/utils/apiBase';

/**
 * Chat 서버 베이스 URL 가져오기
 * 우선순위: runtime config > env > API base URL
 */
export function getChatBaseUrl(): string {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const runtime = w?.APP_CONFIG?.chatBaseUrl ?? w?.__APP_CONFIG?.chatBaseUrl;
  if (typeof runtime === 'string' && runtime) return runtime;

  const env = (import.meta as any)?.env?.VITE_CHAT_BASE_URL as string | undefined;
  if (typeof env === 'string' && env) return env;

  return getApiBaseUrl();
}

export function getChatApiKey(): string | null {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const runtime = w?.APP_CONFIG?.chatApiKey ?? w?.__APP_CONFIG?.chatApiKey;
  if (typeof runtime === 'string' && runtime) return runtime;

  const env = (import.meta as any)?.env?.VITE_CHAT_API_KEY as string | undefined;
  if (typeof env === 'string' && env) return env;

  // Return null instead of empty string to indicate "not configured"
  // Callers should handle null appropriately (skip auth header or fail explicitly)
  return null;
}

/**
 * Chat WebSocket base URL (optional override)
 */
export function getChatWebSocketBaseUrl(): string | null {
  if (typeof window !== 'undefined') {
    try {
      const override = localStorage.getItem('aiMemo.chatWsBaseUrl');
      if (override) {
        const parsed = JSON.parse(override);
        if (typeof parsed === 'string' && parsed) return parsed;
      }
    } catch {
      // ignore parse errors
    }
  }

  const w = typeof window !== 'undefined' ? (window as any) : null;
  const runtime = w?.APP_CONFIG?.chatWsBaseUrl ?? w?.__APP_CONFIG?.chatWsBaseUrl;
  if (typeof runtime === 'string' && runtime) return runtime;

  const env = (import.meta as any)?.env?.VITE_CHAT_WS_URL as string | undefined;
  if (typeof env === 'string' && env) return env;

  return null;
}

/**
 * Determine if WebSocket chat should be attempted
 */
export function shouldUseChatWebSocket(): boolean {
  if (getChatWebSocketBaseUrl()) return true;
  try {
    const base = getChatBaseUrl();
    const url = new URL(base);
    return ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * 불리언 값 파싱 유틸리티
 */
export function getBooleanFromUnknown(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    return lowered === '1' || lowered === 'true' || lowered === 'yes' || lowered === 'on';
  }
  return false;
}

/**
 * 통합 태스크 API 활성화 여부
 */
export function isUnifiedTasksEnabled(): boolean {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const runtimeFlag =
    w?.APP_CONFIG?.aiUnified ?? w?.__APP_CONFIG?.aiUnified ?? undefined;
  if (runtimeFlag !== undefined) return getBooleanFromUnknown(runtimeFlag);

  const envFlag = (import.meta as any)?.env?.VITE_AI_UNIFIED as
    | string
    | boolean
    | undefined;
  return getBooleanFromUnknown(envFlag);
}

/**
 * Chat 엔드포인트 URL 생성 헬퍼
 */
export function buildChatUrl(path: string, sessionId?: string): string {
  const apiBase = getChatBaseUrl().replace(/\/$/, '');
  return sessionId
    ? `${apiBase}/api/v1/chat/session/${encodeURIComponent(sessionId)}${path}`
    : `${apiBase}/api/v1/chat${path}`;
}

/**
 * Chat WebSocket URL builder
 */
export function buildChatWebSocketUrl(sessionId?: string): string {
  const overrideBase = getChatWebSocketBaseUrl();
  const base = (overrideBase || getChatBaseUrl()).replace(/\/$/, '');
  const wsBase = base.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
  const url = new URL(`${wsBase}/api/v1/chat/ws`);
  if (sessionId) url.searchParams.set('sessionId', sessionId);
  return url.toString();
}

/**
 * Chat 요청 헤더 생성
 */
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
