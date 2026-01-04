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
  return '';
}

/**
 * Chat API 키 가져오기
 */
export function getChatApiKey(): string {
  return '';
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
  const apiBase = getApiBaseUrl().replace(/\/$/, '');
  return sessionId
    ? `${apiBase}/api/v1/chat/session/${encodeURIComponent(sessionId)}${path}`
    : `${apiBase}/api/v1/chat${path}`;
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
