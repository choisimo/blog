/**
 * Prompt Factory for AI Tasks
 * 
 * 모든 AI 프롬프트를 중앙에서 관리합니다.
 * 프론트엔드는 mode와 payload만 전송하고, 실제 프롬프트는 여기서 생성됩니다.
 */

export type TaskMode = 'sketch' | 'prism' | 'chain' | 'catalyst' | 'summary' | 'custom';

export type TaskPayload = {
  paragraph?: string;
  content?: string;
  postTitle?: string;
  title?: string;
  persona?: string;
  prompt?: string; // custom 모드용
};

export type PromptConfig = {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  schema?: JsonSchema;
};

export type JsonSchema = {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: unknown;
};

// 공통 시스템 프롬프트
const COMMON_SYSTEM = `You are a helpful AI assistant for a blog platform.
Always respond in the same language as the input text.
Return STRICT JSON matching the schema provided. Do not include markdown code blocks.`;

/**
 * 텍스트를 안전하게 잘라냅니다.
 */
function safeTruncate(s: string | undefined | null, maxLength: number): string {
  if (!s) return '';
  if (s.length <= maxLength) return s;
  return `${s.slice(0, maxLength)}\n...(truncated)`;
}

/**
 * 모드별 JSON 스키마 정의
 */
const SCHEMAS: Record<string, JsonSchema> = {
  sketch: {
    type: 'object',
    properties: {
      mood: { type: 'string' },
      bullets: { type: 'array', items: { type: 'string' } },
    },
    required: ['mood', 'bullets'],
  },
  prism: {
    type: 'object',
    properties: {
      facets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            points: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'points'],
        },
      },
    },
    required: ['facets'],
  },
  chain: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            why: { type: 'string' },
          },
          required: ['q', 'why'],
        },
      },
    },
    required: ['questions'],
  },
  summary: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      keyPoints: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary'],
  },
};

/**
 * 모드별 temperature 설정
 */
export function getTemperature(mode: TaskMode): number {
  switch (mode) {
    case 'sketch':
      return 0.3;
    case 'prism':
    case 'chain':
    case 'summary':
      return 0.2;
    case 'catalyst':
      return 0.4;
    default:
      return 0.3;
  }
}

/**
 * 모드별 maxTokens 설정
 */
export function getMaxTokens(mode: TaskMode): number {
  switch (mode) {
    case 'sketch':
      return 1024;
    case 'prism':
      return 1536;
    case 'chain':
      return 1024;
    case 'summary':
      return 2048;
    default:
      return 2048;
  }
}

/**
 * Sketch 모드 프롬프트 생성
 * 감정(mood)과 핵심 포인트(bullets)를 추출합니다.
 */
function buildSketchPrompt(payload: TaskPayload): PromptConfig {
  const paragraph = safeTruncate(payload.paragraph || payload.content, 2000);
  const postTitle = safeTruncate(payload.postTitle || payload.title, 120);
  const persona = payload.persona || 'default';

  const user = `Task: Capture the emotional sketch of the following text.

Context:
- Blog Post Title: "${postTitle}"
- Persona: ${persona}

Input Text:
"${paragraph}"

Instructions:
1. Identify the primary emotional tone (mood) in a single word (e.g., curious, excited, skeptical, reflective, hopeful)
2. Extract 3-6 key points as short bullet statements
3. Keep bullets concise (under 100 characters each)
4. Maintain the original language of the input text

Response Schema:
${JSON.stringify(SCHEMAS.sketch, null, 2)}`;

  return {
    system: COMMON_SYSTEM,
    user,
    temperature: getTemperature('sketch'),
    maxTokens: getMaxTokens('sketch'),
    schema: SCHEMAS.sketch,
  };
}

/**
 * Prism 모드 프롬프트 생성
 * 텍스트를 여러 관점(facets)에서 분석합니다.
 */
function buildPrismPrompt(payload: TaskPayload): PromptConfig {
  const paragraph = safeTruncate(payload.paragraph || payload.content, 2000);
  const postTitle = safeTruncate(payload.postTitle || payload.title, 120);

  const user = `Task: Analyze the following text from multiple perspectives (facets).

Context:
- Blog Post Title: "${postTitle}"

Input Text:
"${paragraph}"

Instructions:
1. Identify 2-3 distinct perspectives or angles to analyze the text
2. For each perspective, provide a clear title and 2-4 key points
3. Perspectives could include: core argument, implications, counterpoints, applications, etc.
4. Keep each point concise and insightful
5. Maintain the original language of the input text

Response Schema:
${JSON.stringify(SCHEMAS.prism, null, 2)}`;

  return {
    system: COMMON_SYSTEM,
    user,
    temperature: getTemperature('prism'),
    maxTokens: getMaxTokens('prism'),
    schema: SCHEMAS.prism,
  };
}

/**
 * Chain 모드 프롬프트 생성
 * 후속 질문을 생성합니다.
 */
function buildChainPrompt(payload: TaskPayload): PromptConfig {
  const paragraph = safeTruncate(payload.paragraph || payload.content, 2000);
  const postTitle = safeTruncate(payload.postTitle || payload.title, 120);

  const user = `Task: Generate follow-up questions to deepen understanding of the text.

Context:
- Blog Post Title: "${postTitle}"

Input Text:
"${paragraph}"

Instructions:
1. Generate 3-5 thought-provoking follow-up questions
2. Each question should explore a different aspect: assumptions, implications, applications, alternatives, or deeper meanings
3. For each question, briefly explain why it matters (the "why")
4. Questions should encourage critical thinking and further exploration
5. Maintain the original language of the input text

Response Schema:
${JSON.stringify(SCHEMAS.chain, null, 2)}`;

  return {
    system: COMMON_SYSTEM,
    user,
    temperature: getTemperature('chain'),
    maxTokens: getMaxTokens('chain'),
    schema: SCHEMAS.chain,
  };
}

/**
 * Summary 모드 프롬프트 생성
 */
function buildSummaryPrompt(payload: TaskPayload): PromptConfig {
  const content = safeTruncate(payload.paragraph || payload.content, 4000);
  const title = safeTruncate(payload.postTitle || payload.title, 120);

  const user = `Task: Summarize the following content concisely.

Context:
- Title: "${title}"

Content:
"${content}"

Instructions:
1. Provide a clear, concise summary (2-4 sentences)
2. Extract 3-5 key points
3. Maintain the original language

Response Schema:
${JSON.stringify(SCHEMAS.summary, null, 2)}`;

  return {
    system: COMMON_SYSTEM,
    user,
    temperature: getTemperature('summary'),
    maxTokens: getMaxTokens('summary'),
    schema: SCHEMAS.summary,
  };
}

/**
 * Custom/Catalyst 모드 프롬프트 생성
 * 사용자가 직접 프롬프트를 제공하는 경우
 */
function buildCustomPrompt(payload: TaskPayload): PromptConfig {
  const userPrompt = payload.prompt || payload.paragraph || payload.content || '';

  return {
    system: COMMON_SYSTEM,
    user: safeTruncate(userPrompt, 4000),
    temperature: getTemperature('custom'),
    maxTokens: getMaxTokens('custom'),
  };
}

/**
 * 메인 프롬프트 빌더 함수
 * mode에 따라 적절한 프롬프트를 생성합니다.
 */
export function buildTaskPrompt(mode: TaskMode, payload: TaskPayload): PromptConfig {
  switch (mode) {
    case 'sketch':
      return buildSketchPrompt(payload);
    case 'prism':
      return buildPrismPrompt(payload);
    case 'chain':
      return buildChainPrompt(payload);
    case 'summary':
      return buildSummaryPrompt(payload);
    case 'catalyst':
    case 'custom':
    default:
      return buildCustomPrompt(payload);
  }
}

/**
 * 모드가 유효한지 검증합니다.
 */
export function isValidTaskMode(mode: string): mode is TaskMode {
  return ['sketch', 'prism', 'chain', 'catalyst', 'summary', 'custom'].includes(mode);
}

/**
 * 모드별 기본 폴백 데이터
 * LLM 호출 실패 시 사용
 */
export function getFallbackData(mode: TaskMode, payload: TaskPayload): unknown {
  const paragraph = payload.paragraph || payload.content || '';
  
  switch (mode) {
    case 'sketch':
      // 문장 분리하여 bullets로 사용
      const sentences = paragraph
        .replace(/\n+/g, ' ')
        .split(/[.!?]\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 10)
        .slice(0, 4);
      return {
        mood: 'reflective',
        bullets: sentences.length > 0 
          ? sentences.map(s => s.length > 100 ? `${s.slice(0, 98)}...` : s)
          : ['내용을 분석하는 중 오류가 발생했습니다.'],
      };

    case 'prism':
      return {
        facets: [
          {
            title: '핵심 요점',
            points: [paragraph.slice(0, 140) || '분석 중 오류 발생'],
          },
          {
            title: '생각해볼 점',
            points: ['다양한 관점에서 검토 필요', '추가 맥락 확인 권장'],
          },
        ],
      };

    case 'chain':
      return {
        questions: [
          { q: '이 주장의 핵심 근거는 무엇인가?', why: '논리적 기반 확인' },
          { q: '어떤 전제나 가정이 깔려 있는가?', why: '숨겨진 전제 파악' },
          { q: '실제로 어떻게 적용할 수 있는가?', why: '실용적 가치 탐색' },
        ],
      };

    case 'summary':
      return {
        summary: paragraph.slice(0, 200) || '요약을 생성할 수 없습니다.',
        keyPoints: ['원본 텍스트를 확인해주세요.'],
      };

    default:
      return { error: 'Fallback not available for this mode' };
  }
}
