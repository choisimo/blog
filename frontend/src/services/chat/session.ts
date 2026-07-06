/**
 * Chat Service - Unified Session Management
 *
 * 통합 세션 관리 모듈
 * - 백엔드 세션 ID와 로컬 스토리지를 단일 시스템으로 통합
 * - 모든 세션 관련 상수와 함수를 여기서 관리
 */

import { bearerAuth } from '@/lib/auth';
import { getPrincipalToken } from '@/services/session/userContentAuth';
import { buildChatUrl, buildChatHeaders } from './config';

// ============================================================================
// Storage Keys (통합 상수)
// ============================================================================

/** 현재 활성 세션 ID (백엔드 + 로컬 공유) */
export const SESSION_ID_KEY = 'nodove_chat_session_id';

/** 세션 메타데이터 인덱스 (모든 세션 목록) */
export const SESSIONS_INDEX_KEY = 'ai_chat_sessions_index';

/** 세션별 메시지 저장 프리픽스 */
export const SESSION_MESSAGES_PREFIX = 'ai_chat_history_v2_';

/** 세션 저장 옵션 키 */
export const PERSIST_OPTIN_KEY = 'ai_chat_persist_optin';

// Legacy key (마이그레이션용)
const LEGACY_SESSION_KEY = 'ai_chat_current_session_key';
const CHAT_SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_CHAT_TEXT_LENGTH = 1000;
const MAX_CHAT_TITLE_LENGTH = 200;

function normalizeSessionId(sessionId: unknown): string | null {
  if (typeof sessionId !== 'string') return null;
  const value = sessionId.trim();
  if (!value || !CHAT_SESSION_ID_PATTERN.test(value) || /%(?:0a|0d)/i.test(value)) return null;
  return value;
}

function requireSessionId(sessionId: unknown): string {
  const normalized = normalizeSessionId(sessionId);
  if (!normalized) {
    throw new Error('Invalid chat session id');
  }
  return normalized;
}

function normalizeSingleLineText(value: unknown, maxLength = MAX_CHAT_TEXT_LENGTH): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\r\n]/.test(normalized)) return '';
  return normalized;
}

function normalizeOptionalSingleLineText(value: unknown, maxLength = MAX_CHAT_TEXT_LENGTH): string | undefined {
  return normalizeSingleLineText(value, maxLength) || undefined;
}

function normalizeBackendSessionTitle(title?: string): string {
  if (title === undefined || title === null) {
    return 'Nodove Blog Visitor Session';
  }

  const normalized = normalizeSingleLineText(title, MAX_CHAT_TITLE_LENGTH);
  if (!normalized) {
    throw new Error('Invalid chat session title');
  }
  return normalized;
}

// ============================================================================
// Session ID Generation
// ============================================================================

/**
 * 새 세션 ID 생성 (클라이언트 사이드)
 * 백엔드 응답이 없을 때 폴백으로 사용
 */
export function generateLocalSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Session ID Storage
// ============================================================================

/**
 * 현재 저장된 세션 ID 가져오기
 * 레거시 키에서 마이그레이션도 처리
 */
export function getStoredSessionId(): string | null {
  try {
    // 새 키에서 먼저 확인
    const current = normalizeSessionId(localStorage.getItem(SESSION_ID_KEY));
    if (current) {
      if (current !== localStorage.getItem(SESSION_ID_KEY)) {
        localStorage.setItem(SESSION_ID_KEY, current);
      }
      return current;
    }

    if (localStorage.getItem(SESSION_ID_KEY)) {
      localStorage.removeItem(SESSION_ID_KEY);
    }

    // 레거시 키에서 마이그레이션
    const legacy = normalizeSessionId(localStorage.getItem(LEGACY_SESSION_KEY));
    if (legacy) {
      // 새 키로 마이그레이션
      localStorage.setItem(SESSION_ID_KEY, legacy);
      localStorage.removeItem(LEGACY_SESSION_KEY);
      return legacy;
    }

    if (localStorage.getItem(LEGACY_SESSION_KEY)) {
      localStorage.removeItem(LEGACY_SESSION_KEY);
    }
  } catch {
    // localStorage 접근 실패
  }
  return null;
}

/**
 * 세션 ID 저장
 */
export function storeSessionId(sessionId: string): void {
  try {
    const normalized = normalizeSessionId(sessionId);
    if (!normalized) {
      clearStoredSessionId();
      return;
    }

    localStorage.setItem(SESSION_ID_KEY, normalized);
    // 레거시 키가 있다면 제거
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // localStorage 접근 실패
  }
}

/**
 * 세션 ID 삭제 (새 세션 생성 유도)
 */
export function clearStoredSessionId(): void {
  try {
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // localStorage 접근 실패
  }
}

// ============================================================================
// Session Messages Storage
// ============================================================================

/**
 * 세션의 메시지 저장 키 생성
 */
export function getSessionMessagesKey(sessionId: string): string {
  return `${SESSION_MESSAGES_PREFIX}${requireSessionId(sessionId)}`;
}

/**
 * 세션 메시지 저장
 */
export function storeSessionMessages<T>(sessionId: string, messages: T[]): void {
  try {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) return;
    localStorage.setItem(getSessionMessagesKey(sessionId), JSON.stringify(messages));
  } catch {
    // localStorage 접근 실패 또는 용량 초과
  }
}

/**
 * 세션 메시지 로드
 */
export function loadSessionMessages<T>(sessionId: string): T[] {
  try {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) return [];
    const raw = localStorage.getItem(getSessionMessagesKey(normalizedSessionId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }
    }
  } catch {
    // 파싱 실패
  }
  return [];
}

/**
 * 세션 메시지 삭제
 */
export function clearSessionMessages(sessionId: string): void {
  try {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) return;
    localStorage.removeItem(getSessionMessagesKey(normalizedSessionId));
  } catch {
    // localStorage 접근 실패
  }
}

// ============================================================================
// Sessions Index (세션 목록 관리)
// ============================================================================

export type ChatSessionMeta = {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  mode: 'article' | 'general';
  articleUrl?: string;
  articleTitle?: string;
};

function normalizeSessionMode(value: unknown): ChatSessionMeta['mode'] {
  return value === 'general' ? 'general' : 'article';
}

function normalizeStringField(value: unknown): string {
  return normalizeSingleLineText(value);
}

function normalizeOptionalStringField(value: unknown): string | undefined {
  return normalizeOptionalSingleLineText(value);
}

function normalizeMessageCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function normalizeSessionMeta(value: unknown): ChatSessionMeta | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const id = normalizeSessionId(record.id);
  if (!id) return null;

  return {
    id,
    title: normalizeSingleLineText(record.title, MAX_CHAT_TITLE_LENGTH) || 'Untitled session',
    summary: normalizeStringField(record.summary),
    createdAt: normalizeStringField(record.createdAt),
    updatedAt: normalizeStringField(record.updatedAt),
    messageCount: normalizeMessageCount(record.messageCount),
    mode: normalizeSessionMode(record.mode),
    articleUrl: normalizeOptionalStringField(record.articleUrl),
    articleTitle: normalizeOptionalStringField(record.articleTitle),
  };
}

function normalizeSessionsIndex(sessions: unknown): ChatSessionMeta[] {
  if (!Array.isArray(sessions)) return [];
  return sessions.flatMap((session) => {
    const normalized = normalizeSessionMeta(session);
    return normalized ? [normalized] : [];
  });
}

/**
 * 모든 세션 메타데이터 로드
 */
export function loadSessionsIndex(): ChatSessionMeta[] {
  try {
    const raw = localStorage.getItem(SESSIONS_INDEX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = normalizeSessionsIndex(parsed);
      if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
        localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(normalized));
      }
      return normalized;
    }
  } catch {
    try {
      localStorage.removeItem(SESSIONS_INDEX_KEY);
    } catch {
      // localStorage 정리 실패
    }
  }
  return [];
}

/**
 * 세션 메타데이터 저장
 */
export function storeSessionsIndex(sessions: ChatSessionMeta[]): void {
  try {
    localStorage.setItem(
      SESSIONS_INDEX_KEY,
      JSON.stringify(normalizeSessionsIndex(sessions)),
    );
  } catch {
    // localStorage 접근 실패
  }
}

/**
 * 세션 인덱스에서 특정 세션 업데이트
 */
export function updateSessionInIndex(session: ChatSessionMeta): ChatSessionMeta[] {
  const normalizedSession = normalizeSessionMeta(session);
  if (!normalizedSession) {
    return loadSessionsIndex();
  }

  const sessions = loadSessionsIndex();
  const existing = sessions.find((s) => s.id === normalizedSession.id);
  
  let updated: ChatSessionMeta[];
  if (existing) {
    updated = sessions.map((s) =>
      s.id === normalizedSession.id ? normalizedSession : s,
    );
  } else {
    updated = [normalizedSession, ...sessions];
  }
  
  storeSessionsIndex(updated);
  
  // 이벤트 발송 (다른 컴포넌트에서 리스닝 가능)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('aiChat:sessionsUpdated'));
    } catch {
      // 이벤트 발송 실패
    }
  }
  
  return updated;
}

/**
 * 세션 인덱스에서 특정 세션 제거
 */
export function removeSessionFromIndex(sessionId: string): ChatSessionMeta[] {
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!normalizedSessionId) {
    return loadSessionsIndex();
  }

  const sessions = loadSessionsIndex();
  const updated = sessions.filter((s) => s.id !== normalizedSessionId);
  storeSessionsIndex(updated);
  
  // 메시지도 함께 삭제
  clearSessionMessages(normalizedSessionId);
  
  return updated;
}

// ============================================================================
// Persist Option
// ============================================================================

/**
 * 저장 옵션 확인
 */
export function isPersistEnabled(): boolean {
  try {
    const value = localStorage.getItem(PERSIST_OPTIN_KEY);
    return value !== '0';
  } catch {
    return true;
  }
}

/**
 * 저장 옵션 설정
 */
export function setPersistEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PERSIST_OPTIN_KEY, enabled ? '1' : '0');
  } catch {
    // localStorage 접근 실패
  }
}

// ============================================================================
// Backend Session API
// ============================================================================

/**
 * 백엔드에 새 세션 생성 요청
 */
export async function createBackendSession(title?: string): Promise<string> {
  const normalizedTitle = normalizeBackendSessionTitle(title);
  const url = buildChatUrl('/session');
  const headers = buildChatHeaders('json');
  const token = await getPrincipalToken();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      ...bearerAuth(token),
    },
    body: JSON.stringify({ title: normalizedTitle }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Failed to create session: ${res.status} ${t.slice(0, 180)}`);
  }

  const data = (await res.json().catch(() => ({}))) as {
    sessionID?: string;
    id?: string;
    data?: { sessionID?: string; id?: string };
  };
  const id =
    data?.sessionID || data?.id || data?.data?.sessionID || data?.data?.id;

  const normalizedId = normalizeSessionId(id);
  if (!normalizedId) {
    throw new Error('Invalid session response');
  }

  return normalizedId;
}

/**
 * 세션 확보 (기존 세션 또는 새 세션 생성)
 *
 * @param forceNew - true면 무조건 새 세션 생성
 * @returns 세션 ID
 */
export async function ensureSession(forceNew = false): Promise<string> {
  // 강제 새 세션 생성
  if (forceNew) {
    clearStoredSessionId();
  }

  // 기존 세션 확인
  const existing = getStoredSessionId();
  if (existing) {
    return existing;
  }

  // 백엔드에 새 세션 생성 요청
  try {
    const id = await createBackendSession();
    storeSessionId(id);
    return id;
  } catch (err) {
    // 백엔드 실패 시 로컬 세션 ID 생성 (오프라인 지원)
    console.warn('Backend session creation failed, using local ID:', err);
    const localId = generateLocalSessionId();
    storeSessionId(localId);
    return localId;
  }
}

/**
 * 새 세션 시작 (기존 세션 완전 초기화)
 * "대화 초기화" 버튼에서 사용
 *
 * @returns 새 세션 ID
 */
export async function startNewSession(): Promise<string> {
  // 기존 세션 ID 제거
  clearStoredSessionId();

  // 백엔드에 새 세션 생성
  try {
    const id = await createBackendSession();
    storeSessionId(id);
    return id;
  } catch (err) {
    // 백엔드 실패 시 로컬 세션 ID 생성
    console.warn('Backend session creation failed, using local ID:', err);
    const localId = generateLocalSessionId();
    storeSessionId(localId);
    return localId;
  }
}

/**
 * 특정 세션으로 전환
 * 세션 목록에서 선택했을 때 사용
 *
 * @param sessionId - 전환할 세션 ID
 */
export function switchToSession(sessionId: string): void {
  storeSessionId(sessionId);
}
