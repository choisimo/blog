/**
 * Unified LLM Service
 *
 * 모든 AI 호출은 자체 백엔드 서버를 통해 처리됩니다.
 * 외부 API(Gemini 등)는 백엔드 서버에서 관리합니다.
 */

import type { Env } from '../types';
import type { PromptConfig, TaskMode } from './prompts';
import { getFallbackData } from './prompts';
import { getApiBaseUrl, getAiServeApiKey } from './config';

export type LLMRequest = {
  system?: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
};

export type LLMResponse = {
  ok: boolean;
  text: string;
  parsed: unknown | null;
  source: 'backend';
  error?: string;
};

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
    // continue to next method
  }

  // 2. ```json 코드블록 추출
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // continue to next method
    }
  }

  // 3. 첫 { ~ 마지막 } 서브스트링
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch {
      // continue to next method
    }
  }

  // 4. 첫 [ ~ 마지막 ] 서브스트링 (배열 응답용)
  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) {
    try {
      return JSON.parse(text.slice(arrStart, arrEnd + 1)) as T;
    } catch {
      // failed
    }
  }

  return null;
}

/**
 * 백엔드 AI 서버 호출 (/ai/auto-chat 엔드포인트)
 * 대화형 AI 호출에 사용됩니다.
 * 
 * Uses BACKEND_ORIGIN to avoid circular calls (api.nodove.com -> api.nodove.com).
 */
async function callBackendAutoChat(
  request: LLMRequest,
  env: Env
): Promise<{ ok: boolean; text?: string; error?: string }> {
  // Use BACKEND_ORIGIN directly to avoid calling Workers itself
  const backendUrl = env.BACKEND_ORIGIN || await getApiBaseUrl(env);
  const url = `${backendUrl.replace(/\/$/, '')}/api/v1/ai/auto-chat`;

  const message = request.system
    ? `${request.system}\n\n${request.user}`
    : request.user;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const apiKey = await getAiServeApiKey(env);
  if (apiKey) {
    headers['X-Internal-Gateway-Key'] = apiKey;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        temperature: request.temperature,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return {
        ok: false,
        error: `Backend AI error: ${res.status} ${errorText.slice(0, 100)}`,
      };
    }

    const result = (await res.json()) as {
      ok?: boolean;
      data?: { text?: string; content?: string; response?: string };
      text?: string;
      content?: string;
      response?: string;
    };

    const text =
      result?.data?.text ||
      result?.data?.content ||
      result?.data?.response ||
      result?.text ||
      result?.content ||
      result?.response ||
      (typeof result === 'string' ? result : '');

    if (!text) {
      return { ok: false, error: 'No content in Backend AI response' };
    }

    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: `Backend AI fetch failed: ${message}` };
  }
}

/**
 * 백엔드 AI 서버 호출 (/ai/generate 엔드포인트)
 * 단순 텍스트 생성에 사용됩니다.
 * 
 * Uses BACKEND_ORIGIN to avoid circular calls (api.nodove.com -> api.nodove.com).
 */
async function callBackendGenerate(
  request: LLMRequest,
  env: Env
): Promise<{ ok: boolean; text?: string; error?: string }> {
  // Use BACKEND_ORIGIN directly to avoid calling Workers itself
  const base = env.BACKEND_ORIGIN || await getApiBaseUrl(env);
  const url = `${base.replace(/\/$/, '')}/api/v1/ai/generate`;

  const fullPrompt = request.system
    ? `${request.system}\n\n${request.user}`
    : request.user;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey = await getAiServeApiKey(env);
  if (apiKey) {
    headers['X-API-KEY'] = apiKey;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: fullPrompt,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return {
        ok: false,
        error: `Backend generate error: ${res.status} ${errorText.slice(0, 100)}`,
      };
    }

    const result = (await res.json()) as {
      text?: string;
      data?: { text?: string };
    };

    const text = result?.text || result?.data?.text;
    if (!text) {
      return { ok: false, error: 'No content in backend generate response' };
    }

    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: `Backend generate fetch failed: ${message}` };
  }
}

/**
 * 통합 LLM 호출 함수
 *
 * 모든 호출은 자체 백엔드 서버를 통해 처리됩니다.
 * 백엔드 서버가 내부적으로 적절한 AI 모델(Gemini, OpenAI 등)을 선택합니다.
 */
export async function callLLM(
  request: LLMRequest,
  env: Env
): Promise<LLMResponse> {
  // /ai/generate 엔드포인트 시도
  const result = await callBackendGenerate(request, env);

  if (result.ok && result.text) {
    const parsed =
      request.responseFormat === 'json' ? tryParseJson(result.text) : null;
    return {
      ok: true,
      text: result.text,
      parsed,
      source: 'backend',
    };
  }

  // /ai/auto-chat 엔드포인트로 폴백 시도
  console.warn('Backend generate failed, trying auto-chat:', result.error);
  const autoChatResult = await callBackendAutoChat(request, env);

  if (autoChatResult.ok && autoChatResult.text) {
    const parsed =
      request.responseFormat === 'json'
        ? tryParseJson(autoChatResult.text)
        : null;
    return {
      ok: true,
      text: autoChatResult.text,
      parsed,
      source: 'backend',
    };
  }

  // 모든 시도 실패
  return {
    ok: false,
    text: '',
    parsed: null,
    source: 'backend',
    error:
      result.error || autoChatResult.error || 'Backend AI server unavailable',
  };
}

/**
 * Task 모드용 LLM 호출 함수
 * PromptConfig를 받아서 LLM을 호출하고 결과를 반환합니다.
 */
export async function callTaskLLM(
  promptConfig: PromptConfig,
  env: Env
): Promise<LLMResponse> {
  return callLLM({
    system: promptConfig.system,
    user: promptConfig.user,
    temperature: promptConfig.temperature,
    maxTokens: promptConfig.maxTokens,
    responseFormat: 'json',
  }, env);
}

/**
 * Task 실행 함수
 * 프롬프트 생성부터 LLM 호출, 폴백 처리까지 전체 흐름을 담당합니다.
 */
export async function executeTask(
  mode: TaskMode,
  promptConfig: PromptConfig,
  payload: Record<string, unknown>,
  env: Env
): Promise<{ ok: boolean; data: unknown; source: string; error?: string }> {
  // LLM 호출
  const response = await callTaskLLM(promptConfig, env);

  if (response.ok && response.parsed) {
    return {
      ok: true,
      data: response.parsed,
      source: response.source,
    };
  }

  // 텍스트 응답이 있지만 파싱 실패한 경우
  if (response.ok && response.text) {
    // 한 번 더 파싱 시도
    const parsed = tryParseJson(response.text);
    if (parsed) {
      return {
        ok: true,
        data: parsed,
        source: response.source,
      };
    }
    
    // 파싱 실패 - raw 텍스트와 함께 반환
    console.warn('LLM response parsing failed, using raw text');
    return {
      ok: true,
      data: { _raw: response.text },
      source: response.source,
    };
  }

  // 완전 실패 - 폴백 데이터 사용
  console.error('LLM call failed, using fallback data:', response.error);
  return {
    ok: false,
    data: getFallbackData(mode, payload as any),
    source: 'fallback',
    error: response.error,
  };
}
