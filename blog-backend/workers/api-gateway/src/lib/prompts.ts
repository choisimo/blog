import {
  AI_TEMPERATURES,
  MAX_TOKENS,
  TEXT_LIMITS,
  VALID_TASK_MODES,
  FALLBACK_DATA,
  getTemperatureForMode,
  getMaxTokensForMode,
  type TaskMode,
} from '../config/defaults';

export type { TaskMode };

export interface TaskPayload {
  paragraph?: string;
  content?: string;
  postTitle?: string;
  title?: string;
  persona?: string;
  prompt?: string;
  [key: string]: unknown;
}

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

function safeTruncate(s: string | undefined | null, maxLength: number): string {
  if (!s) return '';
  if (s.length <= maxLength) return s;
  return `${s.slice(0, maxLength)}\n...(truncated)`;
}

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

export function getTemperature(mode: TaskMode): number {
  return getTemperatureForMode(mode);
}

export function getMaxTokens(mode: TaskMode): number {
  return getMaxTokensForMode(mode);
}

function buildSketchPrompt(payload: TaskPayload): PromptConfig {
  const paragraph = safeTruncate(payload.paragraph || payload.content, TEXT_LIMITS.PARAGRAPH);
  const postTitle = safeTruncate(payload.postTitle || payload.title, TEXT_LIMITS.TITLE);
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

function buildPrismPrompt(payload: TaskPayload): PromptConfig {
  const paragraph = safeTruncate(payload.paragraph || payload.content, TEXT_LIMITS.PARAGRAPH);
  const postTitle = safeTruncate(payload.postTitle || payload.title, TEXT_LIMITS.TITLE);

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

function buildChainPrompt(payload: TaskPayload): PromptConfig {
  const paragraph = safeTruncate(payload.paragraph || payload.content, TEXT_LIMITS.PARAGRAPH);
  const postTitle = safeTruncate(payload.postTitle || payload.title, TEXT_LIMITS.TITLE);

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

function buildSummaryPrompt(payload: TaskPayload): PromptConfig {
  const content = safeTruncate(payload.paragraph || payload.content, TEXT_LIMITS.CONTENT);
  const title = safeTruncate(payload.postTitle || payload.title, TEXT_LIMITS.TITLE);

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

function buildCustomPrompt(payload: TaskPayload): PromptConfig {
  const userPrompt = payload.prompt || payload.paragraph || payload.content || '';

  return {
    system: COMMON_SYSTEM,
    user: safeTruncate(userPrompt, TEXT_LIMITS.CONTENT),
    temperature: getTemperature('custom'),
    maxTokens: getMaxTokens('custom'),
  };
}

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

export function isValidTaskMode(mode: string): mode is TaskMode {
  return (VALID_TASK_MODES as readonly string[]).includes(mode);
}

export function getFallbackData(mode: TaskMode, payload: TaskPayload): unknown {
  const paragraph = payload.paragraph || payload.content || '';

  switch (mode) {
    case 'sketch': {
      const sentences = paragraph
        .replace(/\n+/g, ' ')
        .split(/[.!?]\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 10)
        .slice(0, 4);
      return {
        mood: FALLBACK_DATA.MOOD,
        bullets: sentences.length > 0
          ? sentences.map(s => s.length > TEXT_LIMITS.BULLET ? `${s.slice(0, TEXT_LIMITS.BULLET - 2)}...` : s)
          : FALLBACK_DATA.SKETCH.BULLETS_ERROR,
      };
    }

    case 'prism':
      return {
        facets: [
          {
            title: FALLBACK_DATA.PRISM.FACETS[0].title,
            points: [paragraph.slice(0, TEXT_LIMITS.PRISM_TRUNCATE) || FALLBACK_DATA.PRISM.FACETS[0].points[0]],
          },
          {
            title: FALLBACK_DATA.PRISM.FACETS[1].title,
            points: [...FALLBACK_DATA.PRISM.FACETS[1].points],
          },
        ],
      };

    case 'chain':
      return {
        questions: FALLBACK_DATA.CHAIN.QUESTIONS.map(q => ({ ...q })),
      };

    case 'summary':
      return {
        summary: paragraph.slice(0, TEXT_LIMITS.SUMMARY_TRUNCATE) || FALLBACK_DATA.SUMMARY.ERROR_MESSAGE,
        keyPoints: [...FALLBACK_DATA.SUMMARY.KEY_POINTS],
      };

    default:
      return { ...FALLBACK_DATA.CUSTOM.ERROR };
  }
}
