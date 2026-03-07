export const TEXT_LIMITS = {
  SKETCH_BULLET: 100,
  PRISM_TRUNCATE: 140,
  SUMMARY_TRUNCATE: 200,
} as const;

export const FALLBACK_DATA = {
  MOOD: 'reflective',

  SKETCH: {
    BULLETS_ERROR: ['내용을 분석할 수 없습니다.'],
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
} as const;

export const RAG_DEFAULTS = {
  CONTEXT_MAX_TOKENS: 2000,
  CONTEXT_TIMEOUT_MS: 8000,
} as const;

export const MEMORY_DEFAULTS = {
  CONTEXT_MAX_TOKENS: 1500,
  CHARS_PER_TOKEN: 4,
  SIMILARITY_THRESHOLD: 0.3,
} as const;
