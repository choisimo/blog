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
  quiz: {
    type: 'object',
    properties: {
      quiz: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            answer: { type: 'string' },
            explanation: { type: 'string' },
          },
          required: ['type', 'question', 'answer', 'explanation'],
        },
      },
    },
    required: ['quiz'],
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


function buildQuizPrompt(payload: TaskPayload): PromptConfig {
  const content = safeTruncate(payload.paragraph || payload.content, TEXT_LIMITS.CONTENT);
  const postTitle = safeTruncate(payload.postTitle || payload.title, TEXT_LIMITS.TITLE);
  const batchIndex = typeof payload.batchIndex === 'number' ? payload.batchIndex : 0;
  const previousQuestions: string[] = Array.isArray(payload.previousQuestions)
    ? (payload.previousQuestions as string[])
    : [];

  const batchNote = batchIndex > 0 && previousQuestions.length > 0
    ? `\n\nAlready asked (do NOT repeat these):\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
    : '';

  const user = `Task: Generate EXACTLY 2 code-focused learning quiz questions for a technical blog post.

Context:
- Blog Post Title: "${postTitle}"
- Batch: ${batchIndex + 1} (generate questions ${batchIndex * 2 + 1}-${batchIndex * 2 + 2})${batchNote}

Content:
"${content}"

## STRICT RULES — VIOLATIONS WILL FAIL:

1. **CODE ONLY**: Every question MUST directly reference specific code from the content above.
   - Quote the actual code line(s) in the question (wrap in backticks).
   - FORBIDDEN: Questions about "main topic", "purpose of document", "what is X concept".
   - FORBIDDEN: Generic comprehension questions that don't cite actual code.

2. **QUESTION TYPES** (exactly 2 questions, mixed types):
   - **fill_blank**: Quote a real code snippet with ONE crucial token replaced by ___.
     Example: \`arr.sort((a, b) => ___ - ___)\` — what fills the blanks?
   - **multiple_choice**: Give 4 options (A-D). Quote actual code, ask what it does / why / what happens if changed.
     Example: In \`while (left <= right)\`, what happens if \`<=\` is changed to \`<\`?
   - **transform**: Show real code, ask to rewrite it (iterative↔recursive, optimize, fix a bug, handle edge case).
     Example: Rewrite this merge step without extra arrays: \`...code...\`
   - **explain**: Quote a specific multi-line block, ask to trace execution step-by-step for given inputs.
     Example: Trace \`mergeSort([3,1,2])\` through lines 12-18. What is the call stack?

3. **DIFFICULTY**: Each batch escalates difficulty.
   - Batch 1: Fill-blank + multiple_choice on specific code syntax/behavior
   - Batch 2+: Transform + explain requiring deep reasoning about algorithm/logic

4. **ANSWER QUALITY**:
   - answer: exact code token or short phrase (for fill_blank/multiple_choice), or model solution (for transform/explain)
   - explanation: 2-3 sentences explaining WHY, referencing the surrounding code context

5. **LANGUAGE**: Match the language of the blog post content.

Generate EXACTLY 2 questions.

Response Schema:
${JSON.stringify(SCHEMAS.quiz, null, 2)}`;

  return {
    system: COMMON_SYSTEM,
    user,
    temperature: getTemperature('quiz'),
    maxTokens: getMaxTokens('quiz'),
    schema: SCHEMAS.quiz,
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
    case 'quiz':
      return buildQuizPrompt(payload);
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


    case 'quiz':
      return {
        quiz: [
          {
            type: 'explain',
            question: '이 내용의 핵심 개념을 설명해보세요.',
            answer: '내용을 다시 읽고 핵심 개념을 파악해보세요.',
            explanation: 'AI 응답 생성에 실패했습니다. 직접 내용을 학습해보세요.',
          },
        ],
      };

    default:
      return { ...FALLBACK_DATA.CUSTOM.ERROR };
  }
}
