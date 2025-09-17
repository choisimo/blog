/*
  AI client for inline features.
  Prefers calling the unified backend API if available, and falls back to
  browser-side Gemini calls using localStorage key 'aiMemo.apiKey'.
  Exposes: sketch, prism, chain with JSON-first parsing and simple fallbacks.
*/
import { getApiBaseUrl } from '@/utils/apiBase';

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

export type StreamEvent =
  | { type: 'open' }
  | { type: 'token'; token: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export async function* streamGenerate(prompt: string, opts?: { temperature?: number }) {
  const base = getApiBaseUrl();
  if (!base) throw new Error('Backend not configured for streaming');
  const url = new URL(`${base.replace(/\/$/, '')}/api/v1/ai/generate/stream`);
  url.searchParams.set('prompt', prompt);
  if (opts?.temperature !== undefined) url.searchParams.set('temperature', String(opts.temperature));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${t.slice(0, 120)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = raw
          .split('\n')
          .filter(l => l.trim().length > 0);
        const dataLines = lines
          .filter(l => l.startsWith('data:'))
          .map(l => l.replace(/^data: ?/, ''));
        const joined = dataLines.join('\n');
        if (!joined) continue;
        let payload: any;
        try {
          payload = JSON.parse(joined);
        } catch {
          payload = { message: joined };
        }
        const t = payload?.type as string | undefined;
        if (payload && payload.token !== undefined) {
          yield { type: 'token', token: String(payload.token) } as StreamEvent;
        } else if (t === 'open' || payload?.ok) {
          yield { type: 'open' } as StreamEvent;
        } else if (t === 'done' || payload?.done) {
          yield { type: 'done' } as StreamEvent;
        } else if (t === 'error' || payload?.message) {
          yield { type: 'error', message: String(payload.message || 'error') } as StreamEvent;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

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
  // 1) Try backend first
  const base = getApiBaseUrl();
  if (base) {
    const url = `${base.replace(/\/$/, '')}/api/v1/ai/generate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, temperature: 0.2 }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}) as any);
      const text = (data?.data?.text || '').toString();
      if (text) return text;
    }
    // if backend fails, continue to fallback
  }

  // 2) Fallback to browser direct Gemini
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
