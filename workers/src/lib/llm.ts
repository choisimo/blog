/**
 * Unified LLM Service
 * 
 * 챗봇과 Inline AI(sketch/prism/chain)가 공유하는 통합 LLM 호출 레이어입니다.
 * 
 * 호출 우선순위:
 * 1. AI Call Gateway (auto-chat) - 챗봇 백엔드
 * 2. Gemini 직접 호출
 * 3. AI Serve Fallback
 */

import type { Env } from '../types';
import { generateContent } from './gemini';
import type { PromptConfig, TaskMode } from './prompts';
import { getFallbackData } from './prompts';
import { getAiCallUrl, getAiGatewayCallerKey } from './config';

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
  source: 'ai-call' | 'gemini' | 'fallback';
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
 * AI Call Gateway (auto-chat) 호출
 * 챗봇 백엔드를 통한 LLM 호출
 */
async function callAiCallGateway(
  request: LLMRequest,
  env: Env
): Promise<{ ok: boolean; text?: string; error?: string }> {
  // Get AI Call URL from KV > env > default
  const aiCallBaseUrl = await getAiCallUrl(env);
  const url = `${aiCallBaseUrl.replace(/\/$/, '')}/auto-chat`;
  
  // system + user 프롬프트 결합
  const message = request.system 
    ? `${request.system}\n\n${request.user}`
    : request.user;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Get gateway caller key from KV > env
  const gatewayCallerKey = await getAiGatewayCallerKey(env);
  if (gatewayCallerKey) {
    headers['X-Gateway-Caller-Key'] = gatewayCallerKey;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        responseFormat: request.responseFormat || 'text',
        temperature: request.temperature,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return { ok: false, error: `AI Call Gateway error: ${res.status} ${errorText.slice(0, 100)}` };
    }

    const result = await res.json() as {
      ok?: boolean;
      data?: { text?: string; content?: string; response?: string };
      text?: string;
      content?: string;
      response?: string;
    };

    // 다양한 응답 형식 대응
    const text = 
      result?.data?.text ||
      result?.data?.content ||
      result?.data?.response ||
      result?.text ||
      result?.content ||
      result?.response ||
      (typeof result === 'string' ? result : '');

    if (!text) {
      return { ok: false, error: 'No content in AI Call response' };
    }

    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: `AI Call Gateway fetch failed: ${message}` };
  }
}

/**
 * Gemini 직접 호출
 */
async function callGemini(
  request: LLMRequest,
  env: Env
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const fullPrompt = request.system
    ? `${request.system}\n\n${request.user}`
    : request.user;

  try {
    const text = await generateContent(fullPrompt, env, {
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: `Gemini call failed: ${message}` };
  }
}

/**
 * 통합 LLM 호출 함수
 * 
 * 호출 순서:
 * 1. AI Call Gateway (챗봇 백엔드) - 설정되어 있고 사용 가능한 경우
 * 2. Gemini 직접 호출 - API 키가 있는 경우
 * 3. 모두 실패 시 에러 반환
 */
export async function callLLM(
  request: LLMRequest,
  env: Env
): Promise<LLMResponse> {
  const errors: string[] = [];

  // 1차: AI Call Gateway 시도
  const aiCallUrl = await getAiCallUrl(env);
  if (aiCallUrl) {
    const result = await callAiCallGateway(request, env);
    if (result.ok && result.text) {
      const parsed = request.responseFormat === 'json' 
        ? tryParseJson(result.text)
        : null;
      return {
        ok: true,
        text: result.text,
        parsed,
        source: 'ai-call',
      };
    }
    if (result.error) {
      errors.push(result.error);
      console.warn('AI Call Gateway failed, trying Gemini:', result.error);
    }
  }

  // 2차: Gemini 직접 호출
  if (env.GEMINI_API_KEY) {
    const result = await callGemini(request, env);
    if (result.ok && result.text) {
      const parsed = request.responseFormat === 'json'
        ? tryParseJson(result.text)
        : null;
      return {
        ok: true,
        text: result.text,
        parsed,
        source: 'gemini',
      };
    }
    if (result.error) {
      errors.push(result.error);
      console.warn('Gemini call failed:', result.error);
    }
  }

  // 모든 시도 실패
  return {
    ok: false,
    text: '',
    parsed: null,
    source: 'fallback',
    error: errors.join('; ') || 'No LLM provider available',
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
