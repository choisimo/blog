/**
 * AI Client for Inline Features
 * 
 * Thin Client 구조:
 * - 프론트엔드는 mode와 payload만 전송
 * - 프롬프트 생성 및 LLM 호출은 Workers에서 처리
 * - 에러 시 클라이언트 사이드 폴백 제공
 */
import { ensureSession } from '@/services/chat';
import { getApiBaseUrl } from '@/utils/apiBase';

// ============================================================================
// Types
// ============================================================================

export type SketchResult = {
  mood: string;
  bullets: string[];
};

export type PrismResult = {
  facets: Array<{
    title: string;
    points: string[];
  }>;
};

export type ChainResult = {
  questions: Array<{
    q: string;
    why: string;
  }>;
};

export type SummaryResult = {
  summary: string;
  keyPoints?: string[];
};

type TaskMode = 'sketch' | 'prism' | 'chain' | 'summary' | 'custom';

type TaskPayload = {
  paragraph?: string;
  postTitle?: string;
  persona?: string;
  [key: string]: unknown;
};

type TaskResponse<T> = {
  ok: boolean;
  data: T;
  mode: string;
  source?: 'ai-call' | 'gemini' | 'fallback';
  _fallback?: boolean;
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * 객체인지 확인
 */
function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

/**
 * JSON 파싱 (서버 응답이 문자열인 경우 대비)
 */
function tryParseJson<T = unknown>(text: string): T | null {
  if (!text || typeof text !== 'string') return null;

  // 직접 파싱
  try {
    return JSON.parse(text) as T;
  } catch {
    // continue
  }

  // 코드블록 추출
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      // continue
    }
  }

  // { } 서브스트링
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

/**
 * 텍스트 안전 자르기 (폴백용)
 */
function safeTruncate(s: string, maxLength: number): string {
  if (!s) return '';
  return s.length > maxLength ? `${s.slice(0, maxLength - 1)}...` : s;
}

// ============================================================================
// Core API
// ============================================================================

/**
 * Workers API를 통해 AI Task 실행
 * 
 * 프론트엔드는 mode와 payload만 전송합니다.
 * 프롬프트 생성은 Workers에서 처리됩니다.
 */
async function invokeTask<T>(
  mode: TaskMode,
  payload: TaskPayload
): Promise<T> {
  const sessionId = await ensureSession();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/chat/session/${encodeURIComponent(sessionId)}/task`;

  const body = {
    mode,
    payload, // 프롬프트 없이 payload만 전송
    context: {
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      title: typeof document !== 'undefined' ? document.title : undefined,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI task error: ${res.status} ${text.slice(0, 180)}`);
  }

  const result = (await res.json()) as TaskResponse<T>;

  // data 추출 (다양한 응답 구조 대응)
  const data = result?.data ?? (result as unknown as { result?: T })?.result ?? result;

  if (!data) {
    throw new Error('Invalid AI task response: no data');
  }

  return data as T;
}

/**
 * 응답 데이터 검증 및 정규화
 */
function normalizeResponse<T>(
  raw: unknown,
  validator: (data: unknown) => data is T
): T | null {
  // 직접 검증
  if (validator(raw)) {
    return raw;
  }

  // nested data 구조 확인
  if (isRecord(raw) && 'data' in raw && validator(raw.data)) {
    return raw.data as T;
  }

  // 문자열인 경우 JSON 파싱 시도
  if (typeof raw === 'string') {
    const parsed = tryParseJson<T>(raw);
    if (parsed && validator(parsed)) {
      return parsed;
    }
  }

  return null;
}

// ============================================================================
// Validators
// ============================================================================

function isSketchResult(data: unknown): data is SketchResult {
  return (
    isRecord(data) &&
    typeof data.mood === 'string' &&
    Array.isArray(data.bullets)
  );
}

function isPrismResult(data: unknown): data is PrismResult {
  return isRecord(data) && Array.isArray(data.facets);
}

function isChainResult(data: unknown): data is ChainResult {
  return isRecord(data) && Array.isArray(data.questions);
}

// ============================================================================
// Fallback Generators
// ============================================================================

function createSketchFallback(paragraph: string): SketchResult {
  const sentences = (paragraph || '')
    .replace(/\n+/g, ' ')
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10)
    .slice(0, 4);

  return {
    mood: 'reflective',
    bullets:
      sentences.length > 0
        ? sentences.map(s => safeTruncate(s, 100))
        : ['내용을 분석할 수 없습니다.'],
  };
}

function createPrismFallback(paragraph: string): PrismResult {
  return {
    facets: [
      {
        title: '핵심 요점',
        points: [safeTruncate(paragraph, 140) || '분석 중 오류 발생'],
      },
      {
        title: '생각해볼 점',
        points: ['다양한 관점에서 검토 필요', '추가 맥락 확인 권장'],
      },
    ],
  };
}

function createChainFallback(): ChainResult {
  return {
    questions: [
      { q: '이 주장의 핵심 근거는 무엇인가?', why: '논리적 기반 확인' },
      { q: '어떤 전제나 가정이 깔려 있는가?', why: '숨겨진 전제 파악' },
      { q: '실제로 어떻게 적용할 수 있는가?', why: '실용적 가치 탐색' },
    ],
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Sketch: 감정(mood)과 핵심 포인트(bullets) 추출
 */
export async function sketch(input: {
  paragraph: string;
  postTitle?: string;
  persona?: string;
}): Promise<SketchResult> {
  const { paragraph, postTitle, persona } = input;

  try {
    const response = await invokeTask<SketchResult>('sketch', {
      paragraph,
      postTitle,
      persona,
    });

    const normalized = normalizeResponse(response, isSketchResult);
    if (normalized) {
      return {
        mood: normalized.mood,
        bullets: normalized.bullets.slice(0, 10),
      };
    }

    throw new Error('Invalid sketch response format');
  } catch (err) {
    console.error('Sketch AI call failed:', err);
    return createSketchFallback(paragraph);
  }
}

/**
 * Prism: 다각도 분석 (facets)
 */
export async function prism(input: {
  paragraph: string;
  postTitle?: string;
}): Promise<PrismResult> {
  const { paragraph, postTitle } = input;

  try {
    const response = await invokeTask<PrismResult>('prism', {
      paragraph,
      postTitle,
    });

    const normalized = normalizeResponse(response, isPrismResult);
    if (normalized) {
      return {
        facets: normalized.facets.slice(0, 4),
      };
    }

    throw new Error('Invalid prism response format');
  } catch (err) {
    console.error('Prism AI call failed:', err);
    return createPrismFallback(paragraph);
  }
}

/**
 * Chain: 후속 질문 생성
 */
export async function chain(input: {
  paragraph: string;
  postTitle?: string;
}): Promise<ChainResult> {
  const { paragraph, postTitle } = input;

  try {
    const response = await invokeTask<ChainResult>('chain', {
      paragraph,
      postTitle,
    });

    const normalized = normalizeResponse(response, isChainResult);
    if (normalized) {
      return {
        questions: normalized.questions.slice(0, 6),
      };
    }

    throw new Error('Invalid chain response format');
  } catch (err) {
    console.error('Chain AI call failed:', err);
    return createChainFallback();
  }
}

/**
 * Summary: 요약 생성 (새로 추가)
 */
export async function summary(input: {
  paragraph: string;
  postTitle?: string;
}): Promise<SummaryResult> {
  const { paragraph, postTitle } = input;

  try {
    const response = await invokeTask<SummaryResult>('summary', {
      paragraph,
      postTitle,
    });

    if (isRecord(response) && typeof response.summary === 'string') {
      return {
        summary: response.summary,
        keyPoints: Array.isArray(response.keyPoints) ? response.keyPoints : undefined,
      };
    }

    throw new Error('Invalid summary response format');
  } catch (err) {
    console.error('Summary AI call failed:', err);
    return {
      summary: safeTruncate(paragraph, 200) || '요약을 생성할 수 없습니다.',
      keyPoints: ['원본 텍스트를 확인해주세요.'],
    };
  }
}
