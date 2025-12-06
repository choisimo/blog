/**
 * Chat Service - Session Management
 *
 * 세션 생성 및 관리
 */

import { buildChatUrl, buildChatHeaders } from './config';

const SESSION_STORAGE_KEY = 'nodove_chat_session_id';

/**
 * 기존 세션 ID 가져오기
 */
export function getStoredSessionId(): string | null {
  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && typeof existing === 'string' && existing.trim()) {
      return existing;
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
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // localStorage 접근 실패
  }
}

/**
 * 세션 ID 삭제 (재생성 필요 시)
 */
export function clearStoredSessionId(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // localStorage 접근 실패
  }
}

/**
 * 세션 확보 (기존 세션 또는 새 세션 생성)
 *
 * @returns 세션 ID
 * @throws 세션 생성 실패 시
 */
export async function ensureSession(): Promise<string> {
  // 기존 세션 확인
  const existing = getStoredSessionId();
  if (existing) {
    return existing;
  }

  // 새 세션 생성
  const url = buildChatUrl('/session');
  const headers = buildChatHeaders('json');

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Nodove Blog Visitor Session' }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Failed to create session: ${res.status} ${t.slice(0, 180)}`);
  }

  const data = (await res.json().catch(() => ({}))) as any;
  const id =
    data?.sessionID || data?.id || data?.data?.sessionID || data?.data?.id;

  if (!id || typeof id !== 'string') {
    throw new Error('Invalid session response');
  }

  storeSessionId(id);
  return id;
}
