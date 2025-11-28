/*
  AI client for inline features.
  Always calls the nodove.com AI agent API for sketch, prism, chain operations.
  Uses the same backend as the chat widget for consistent AI responses.
*/
import { ensureSession } from '@/services/chat';

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

// AI Agent API base URL - always use nodove.com AI service
const AI_AGENT_BASE_URL = 'https://ai-serve.nodove.com';

function safeTruncate(s: string, n: number) {
  if (!s) return s;
  return s.length > n ? `${s.slice(0, n)}\n…(truncated)` : s;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
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

// Invoke AI agent task via nodove.com API
async function invokeAiAgentTask<T>(mode: string, prompt: string, payload: Record<string, unknown>): Promise<T> {
  const sessionId = await ensureSession();
  const url = `${AI_AGENT_BASE_URL}/session/${encodeURIComponent(sessionId)}/task`;
  
  const body = {
    mode,
    prompt,
    payload,
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
    throw new Error(`AI agent error: ${res.status} ${text.slice(0, 180)}`);
  }

  const result = await res.json();
  
  // Extract data from response
  const data = result?.data ?? result?.result ?? result?.output ?? result?.payload ?? result;
  
  if (!data) {
    throw new Error('Invalid AI agent response: no data');
  }
  
  return data as T;
}

export async function sketch(input: {
  paragraph: string;
  postTitle?: string;
  persona?: string;
}): Promise<SketchResult> {
  const { paragraph, postTitle, persona } = input;
  const prompt = [
    'You are a helpful writing companion. Return STRICT JSON only matching the schema.',
    '{"mood":"string","bullets":["string","string","..."]}',
    '',
    `Persona: ${persona || 'default'}`,
    `Post: ${safeTruncate(postTitle || '', 120)}`,
    'Paragraph:',
    safeTruncate(paragraph, 1600),
    '',
    'Task: Capture the emotional sketch. Select a concise mood (e.g., curious, excited, skeptical) and 3-6 short bullets in the original language of the text.',
  ].join('\n');

  try {
    const res = await invokeAiAgentTask<SketchResult | { data?: SketchResult }>('sketch', prompt, {
      paragraph,
      postTitle,
      persona,
    });
    
    // Handle nested data structure
    const data = isRecord(res) && 'data' in res ? (res as any).data : res;
    
    if (
      isRecord(data) &&
      Array.isArray((data as any).bullets) &&
      typeof (data as any).mood === 'string'
    ) {
      return {
        mood: String((data as any).mood),
        bullets: ((data as any).bullets as string[]).slice(0, 10),
      };
    }
    
    // Try parsing as JSON string if data is a string
    if (typeof data === 'string') {
      const parsed = tryParseJson<SketchResult>(data);
      if (parsed && Array.isArray(parsed.bullets) && typeof parsed.mood === 'string') {
        return {
          mood: parsed.mood,
          bullets: parsed.bullets.slice(0, 10),
        };
      }
    }
    
    throw new Error('Invalid sketch response format');
  } catch (err) {
    console.error('Sketch AI call failed:', err);
    // Return minimal fallback on error
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
    const res = await invokeAiAgentTask<PrismResult | { data?: PrismResult }>('prism', prompt, {
      paragraph,
      postTitle,
    });
    
    // Handle nested data structure
    const data = isRecord(res) && 'data' in res ? (res as any).data : res;
    
    if (isRecord(data) && Array.isArray((data as any).facets)) {
      return { facets: ((data as any).facets as PrismResult['facets']).slice(0, 4) };
    }
    
    // Try parsing as JSON string if data is a string
    if (typeof data === 'string') {
      const parsed = tryParseJson<PrismResult>(data);
      if (parsed && Array.isArray(parsed.facets)) {
        return { facets: parsed.facets.slice(0, 4) };
      }
    }
    
    throw new Error('Invalid prism response format');
  } catch (err) {
    console.error('Prism AI call failed:', err);
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
    const res = await invokeAiAgentTask<ChainResult | { data?: ChainResult }>('chain', prompt, {
      paragraph,
      postTitle,
    });
    
    // Handle nested data structure
    const data = isRecord(res) && 'data' in res ? (res as any).data : res;
    
    if (isRecord(data) && Array.isArray((data as any).questions)) {
      return {
        questions: ((data as any).questions as ChainResult['questions']).slice(0, 6),
      };
    }
    
    // Try parsing as JSON string if data is a string
    if (typeof data === 'string') {
      const parsed = tryParseJson<ChainResult>(data);
      if (parsed && Array.isArray(parsed.questions)) {
        return { questions: parsed.questions.slice(0, 6) };
      }
    }
    
    throw new Error('Invalid chain response format');
  } catch (err) {
    console.error('Chain AI call failed:', err);
    return {
      questions: [
        { q: '무엇이 핵심 주장인가?', why: '핵심을 명료화' },
        { q: '어떤 가정이 있는가?', why: '숨은 전제 확인' },
        { q: '적용 예시는?', why: '구체화' },
      ],
    };
  }
}
