/**
 * Workers Config Defaults
 *
 * 모든 기본값과 fallback 데이터를 중앙에서 관리합니다.
 * 프론트엔드는 mode와 payload만 전송하고, 실제 값들은 여기서 참조됩니다.
 */

// =============================================================================
// AI Temperatures
// =============================================================================
export const AI_TEMPERATURES = {
  SKETCH: 0.3,
  PRISM: 0.2,
  CHAIN: 0.2,
  SUMMARY: 0.2,
  CATALYST: 0.4,
  CUSTOM: 0.3,
  TRANSLATE: 0.1,
  TRANSLATE_CONTENT: 0.2,
  AGGREGATE: 0.2,
  GENERATE: 0.2,
} as const;

// =============================================================================
// Max Tokens
// =============================================================================
export const MAX_TOKENS = {
  SKETCH: 1024,
  PRISM: 1536,
  CHAIN: 1024,
  SUMMARY: 2048,
  CUSTOM: 2048,
  TRANSLATE_TITLE: 256,
  TRANSLATE_DESC: 512,
  TRANSLATE_CONTENT: 16000,
} as const;

// =============================================================================
// Text Limits
// =============================================================================
export const TEXT_LIMITS = {
  PARAGRAPH: 2000,
  CONTENT: 4000,
  TITLE: 120,
  BULLET: 100,
  TRANSLATE_CONTENT: 30000,
  PRISM_TRUNCATE: 140,
  SUMMARY_TRUNCATE: 200,
} as const;

// =============================================================================
// Streaming
// =============================================================================
export const STREAMING = {
  CHUNK_SIZE: 80,
  CHUNK_DELAY: 25, // ms
} as const;

// =============================================================================
// Valid Task Modes
// =============================================================================
export const VALID_TASK_MODES = [
  'sketch',
  'prism',
  'chain',
  'catalyst',
  'summary',
  'custom',
] as const;

// =============================================================================
// Fallback Data (Korean)
// =============================================================================
export const FALLBACK_DATA = {
  MOOD: 'reflective',

  SKETCH: {
    BULLETS_ERROR: ['내용을 분석하는 중 오류가 발생했습니다.'],
  },

  PRISM: {
    FACETS: [
      {
        title: '핵심 요점',
        points: ['분석 중 오류 발생'],
      },
      {
        title: '생각해볼 점',
        points: ['다양한 관점에서 검토 필요', '추가 맥락 확인 권장'],
      },
    ],
  },

  CHAIN: {
    QUESTIONS: [
      { q: '이 주장의 핵심 근거는 무엇인가?', why: '논리적 기반 확인' },
      { q: '어떤 전제나 가정이 깔려 있는가?', why: '숨겨진 전제 파악' },
      { q: '실제로 어떻게 적용할 수 있는가?', why: '실용적 가치 탐색' },
    ],
  },

  SUMMARY: {
    ERROR_MESSAGE: '요약을 생성할 수 없습니다.',
    KEY_POINTS: ['원본 텍스트를 확인해주세요.'],
  },

  CUSTOM: {
    ERROR: { error: 'Fallback not available for this mode' },
  },
} as const;

// =============================================================================
// Error Messages (Korean)
// =============================================================================
export const ERROR_MESSAGES = {
  AI_SERVER_ERROR: 'AI 서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  AI_TIMEOUT: 'AI 응답 지연 중입니다. 잠시 후 다시 시도해주세요.',
} as const;

// =============================================================================
// Helper Types
// =============================================================================
export type TaskMode = (typeof VALID_TASK_MODES)[number];

// Type-safe temperature getter
export function getTemperatureForMode(mode: TaskMode): number {
  switch (mode) {
    case 'sketch':
      return AI_TEMPERATURES.SKETCH;
    case 'prism':
    case 'chain':
    case 'summary':
      return AI_TEMPERATURES.PRISM; // Same as CHAIN, SUMMARY
    case 'catalyst':
      return AI_TEMPERATURES.CATALYST;
    case 'custom':
    default:
      return AI_TEMPERATURES.CUSTOM;
  }
}

// Type-safe max tokens getter
export function getMaxTokensForMode(mode: TaskMode): number {
  switch (mode) {
    case 'sketch':
      return MAX_TOKENS.SKETCH;
    case 'prism':
      return MAX_TOKENS.PRISM;
    case 'chain':
      return MAX_TOKENS.CHAIN;
    case 'summary':
      return MAX_TOKENS.SUMMARY;
    case 'catalyst':
    case 'custom':
    default:
      return MAX_TOKENS.CUSTOM;
  }
}
