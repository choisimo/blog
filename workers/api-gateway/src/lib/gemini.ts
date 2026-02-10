/**
 * AI Content Generation Module
 *
 * 모든 AI 호출은 자체 백엔드 서버(ai-check.nodove.com)를 통해 처리됩니다.
 * 외부 API(Gemini 등)는 백엔드 서버에서 관리하며, Workers에서는 직접 호출하지 않습니다.
 *
 * 이 구조의 장점:
 * 1. API 키 관리 일원화 - 백엔드에서만 관리
 * 2. 비용 추적 용이 - 백엔드에서 모든 AI 호출 로깅
 * 3. 모델 전환 유연성 - 백엔드만 수정하면 됨
 * 4. 장애 대응 - 백엔드에서 폴백 로직 처리
 */

import type { Env } from '../types';
import { getAiServeUrl, getAiServeApiKey } from './config';

export type GenerateOptions = {
  temperature?: number;
  maxTokens?: number;
};

/**
 * 백엔드 AI 서버를 통해 콘텐츠를 생성합니다.
 *
 * @deprecated Use createAIService(env).generate() from ai-service.ts instead
 * 
 * @param prompt - 생성할 프롬프트
 * @param env - Worker 환경 변수
 * @param options - 생성 옵션 (temperature, maxTokens)
 * @returns 생성된 텍스트
 * @throws 백엔드 서버 오류 시 예외 발생
 */
export async function generateContent(
  prompt: string,
  env: Env,
  options?: GenerateOptions
): Promise<string> {
  const temperature = options?.temperature ?? 0.2;
  const maxTokens = options?.maxTokens ?? 2048;

  // Use BACKEND_ORIGIN to avoid circular calls (api.nodove.com -> api.nodove.com)
  const base = env.BACKEND_ORIGIN || await getAiServeUrl(env);
  const url = `${base.replace(/\/$/, '')}/api/v1/ai/generate`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Blog-Workers/1.0',
    'Accept': 'application/json',
  };
  const apiKey = await getAiServeApiKey(env);
  if (apiKey) {
    headers['X-API-KEY'] = apiKey;
  }
  if (env.BACKEND_KEY) {
    headers['X-Backend-Key'] = env.BACKEND_KEY;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, temperature, maxTokens }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Backend AI error: ${res.status} ${txt.slice(0, 200)}`);
  }

  const payload = (await res.json().catch(() => null)) as {
    text?: string;
    data?: { text?: string };
    ok?: boolean;
  } | null;

  // 다양한 응답 형식 지원
  const text = payload?.text || payload?.data?.text;
  if (!text) {
    throw new Error('No content in backend AI response');
  }
  return text;
}

/**
 * JSON 파싱 유틸리티
 * LLM 응답에서 JSON을 추출합니다.
 */
export function tryParseJson<T = unknown>(text: string): T | null {
  if (!text || typeof text !== 'string') return null;

  // 1. 직접 파싱 시도
  try {
    return JSON.parse(text) as T;
  } catch {
    // continue
  }

  // 2. ```json 코드블록 추출
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // continue
    }
  }

  // 3. 첫 { ~ 마지막 } 서브스트링
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch {
      // continue
    }
  }

  return null;
}
