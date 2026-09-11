import { getApiBaseUrl } from '@/utils/network/apiBase';
import { getScopedPrincipalHeaders, preferenceScope } from './agentPreferences';
import type { AgentPreferences } from './agentPreferences';

export type ReaderImage = { id: string; url: string; alt: string; width: number; height: number;
  source: 'ai-generated'; expiresAt: string };
export type ImagePolicy = { tier: 'guest' | 'member'; dailyLimit: number; used: number; remaining: number;
  resetAt: string; timezone: string; networkLimited: boolean; enabled: boolean; retentionDays: number };
export class ReaderImageError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); this.name = 'ReaderImageError'; }
}
export type ImageInput = { prompt: string; alt: string; size: AgentPreferences['imageSize'];
  style: AgentPreferences['imageStyle']; purpose: 'chat' | 'debate' };
async function request<T>(path: string, body?: ImageInput, key?: string, scope = preferenceScope()): Promise<T> {
  let headers: Headers;
  try { headers = await getScopedPrincipalHeaders(scope, { 'Content-Type': 'application/json' }); }
  catch (e) { throw new ReaderImageError(e instanceof Error ? e.message : '계정이 변경되었습니다.', 'ACCOUNT_CHANGED', 401); }
  if (key) headers.set('Idempotency-Key', key);
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/images${path}`, { method: body ? 'POST' : 'GET',
      headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(body ? 315000 : 20000) });
  } catch { throw new ReaderImageError('연결이 끊겼습니다. 새로 생성하지 않고 상태를 확인하세요.', 'IMAGE_OUTCOME_UNKNOWN', 0); }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const messages: Record<string, string> = {
      IMAGE_DISABLED: '이미지 생성 준비 중입니다. 글 답변은 계속 사용할 수 있습니다.',
      IMAGE_UNAVAILABLE: '이미지 생성 연결이 준비되지 않았습니다.',
      IMAGE_POLICY_UNAVAILABLE: '사용량을 확인하지 못해 생성하지 않았습니다.',
      IMAGE_REJECTED: '생성이 거절되었습니다. 사용량은 차감하지 않았습니다. 내용을 바꿔 새로 질문하세요.',
    };
    const code = payload?.error?.code || 'IMAGE_ERROR';
    throw new ReaderImageError(messages[code] || payload?.error?.message || '이미지를 불러오지 못했습니다.', code, response.status);
  }
  return payload.data as T;
}
export const getImagePolicy = () => request<ImagePolicy>('/generation-policy');
export const generateReaderImage = (input: ImageInput, key: string, scope?: string) => request<ReaderImage>('/generate', input, key, scope);
export const getReaderImageJob = (key: string, scope?: string) => request<ReaderImage>(`/generations/${encodeURIComponent(key)}`, undefined, undefined, scope);
export async function loadReaderImageBlob(image: ReaderImage, scope = preferenceScope()): Promise<Blob> {
  // Only the authenticated private image endpoint is loadable; never follow a model-supplied URL.
  if (!/^\/api\/v1\/images\/generated\/[a-f0-9]{64}$/.test(image.url)) throw new Error('잘못된 이미지 주소입니다.');
  const response = await fetch(`${getApiBaseUrl()}${image.url}`, { headers: await getScopedPrincipalHeaders(scope),
    redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(response.status === 404 ? '이미지 보관 기간이 지났습니다.' : '이미지를 열지 못했습니다.');
  if (!response.headers.get('Content-Type')?.startsWith('image/png')) throw new Error('잘못된 이미지 형식입니다.');
  return response.blob();
}
