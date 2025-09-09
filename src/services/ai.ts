/*
  Browser-only Gemini client for inline AI features.
  Reads API key from localStorage key 'aiMemo.apiKey'.
  Exposes three high-level functions: sketch, prism, chain with JSON-first parsing and simple fallbacks.
*/

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

const GEMINI_MODEL = 'gemini-1.5-flash';

function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem('aiMemo.apiKey');
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

function safeTruncate(s: string, n: number) {
  if (!s) return s;
  return s.length > n ? `${s.slice(0, n)}\n…(truncated)` : s;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

async function generateContent(prompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Missing Gemini API key in aiMemo.apiKey');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini error(${res.status}) ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const parts: string[] = (
    (data?.candidates?.[0]?.content?.parts as Array<unknown> | undefined) || []
  ).map(p => {
    if (
      p &&
      typeof p === 'object' &&
      'text' in (p as Record<string, unknown>)
    ) {
      const obj = p as Record<string, unknown>;
      return typeof obj.text === 'string' ? obj.text : '';
    }
    return '';
  });
  return parts.join('');
}

function tryParseJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  // try direct parse
  try {
    return JSON.parse(text) as T;
  } catch {
    void 0;
  }
  // try fenced code block extraction
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    try {
      return JSON.parse(fence[1]) as T;
    } catch {
      void 0;
    }
  }
  // try substring between first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const maybe = text.slice(start, end + 1);
    try {
      return JSON.parse(maybe) as T;
    } catch {
      void 0;
    }
  }
  return null;
}

export async function sketch(input: {
  paragraph: string;
  postTitle?: string;
  persona?: string;
}): Promise<SketchResult> {
  const { paragraph, postTitle, persona } = input;
  const prompt = [
    'You are a helpful writing companion. Return STRICT JSON only matching the schema.',
    '{"mood":"string","bullets":["string", "string", "..."]}',
    '',
    `Persona: ${persona || 'default'}`,
    `Post: ${safeTruncate(postTitle || '', 120)}`,
    'Paragraph:',
    safeTruncate(paragraph, 1600),
    '',
    'Task: Capture the emotional sketch. Select a concise mood (e.g., curious, excited, skeptical) and 3-6 short bullets in the original language of the text.',
  ].join('\n');

  try {
    const text = await generateContent(prompt);
    const json = tryParseJson(text);
    if (
      isRecord(json) &&
      Array.isArray(json.bullets) &&
      typeof json.mood === 'string'
    ) {
      return {
        mood: json.mood as string,
        bullets: (json.bullets as string[]).slice(0, 10),
      };
    }
    throw new Error('Invalid JSON');
  } catch {
    // fallback
    const sentences = (paragraph || '')
      .replace(/\n+/g, ' ')
      .split(/[.!?]\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    return {
      mood: 'curious',
      bullets: sentences
        .slice(0, 4)
        .map(s => (s.length > 140 ? `${s.slice(0, 138)}…` : s)),
    };
  }
}

export async function prism(input: {
  paragraph: string;
  postTitle?: string;
}): Promise<PrismResult> {
  const { paragraph, postTitle } = input;
  const prompt = [
    'Return STRICT JSON only for idea facets.',
    '{"facets":[{"title":"string","points":["string","string"]}]}',
    `Post: ${safeTruncate(postTitle || '', 120)}`,
    'Paragraph:',
    safeTruncate(paragraph, 1600),
    '',
    'Task: Provide 2-3 facets (titles) with 2-4 concise points each, in the original language.',
  ].join('\n');

  try {
    const text = await generateContent(prompt);
    const json = tryParseJson(text);
    if (isRecord(json) && Array.isArray(json.facets)) {
      return { facets: (json.facets as PrismResult['facets']).slice(0, 4) };
    }
    throw new Error('Invalid JSON');
  } catch {
    return {
      facets: [
        { title: '핵심 요점', points: [safeTruncate(paragraph, 140)] },
        { title: '생각해볼 점', points: ['관점 A', '관점 B'] },
      ],
    };
  }
}

export async function chain(input: {
  paragraph: string;
  postTitle?: string;
}): Promise<ChainResult> {
  const { paragraph, postTitle } = input;
  const prompt = [
    'Return STRICT JSON only for tail questions.',
    '{"questions":[{"q":"string","why":"string"}]}',
    `Post: ${safeTruncate(postTitle || '', 120)}`,
    'Paragraph:',
    safeTruncate(paragraph, 1600),
    '',
    'Task: Generate 3-5 short follow-up questions and a brief why for each, in the original language.',
  ].join('\n');

  try {
    const text = await generateContent(prompt);
    const json = tryParseJson(text);
    if (isRecord(json) && Array.isArray(json.questions)) {
      return {
        questions: (json.questions as ChainResult['questions']).slice(0, 6),
      };
    }
    throw new Error('Invalid JSON');
  } catch {
    return {
      questions: [
        { q: '무엇이 핵심 주장인가?', why: '핵심을 명료화' },
        { q: '어떤 가정이 있는가?', why: '숨은 전제 확인' },
        { q: '적용 예시는?', why: '구체화' },
      ],
    };
  }
}
