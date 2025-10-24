import { Hono } from 'hono';
import type { Env } from '../types';
import { success, badRequest } from '../lib/response';
import { generateContent, tryParseJson } from '../lib/gemini';

const ai = new Hono<{ Bindings: Env }>();

function safeTruncate(s: string, n: number): string {
  if (!s) return s;
  return s.length > n ? `${s.slice(0, n)}\n…(truncated)` : s;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

// POST /ai/sketch - Generate emotional sketch from paragraph
ai.post('/sketch', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { paragraph, postTitle, persona } = body;

  if (!paragraph || typeof paragraph !== 'string') {
    return badRequest(c, 'paragraph is required');
  }

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
    const text = await generateContent(prompt, c.env, { temperature: 0.3 });
    const json = tryParseJson(text);

    if (isRecord(json) && Array.isArray(json.bullets) && typeof json.mood === 'string') {
      return success(c, {
        mood: json.mood,
        bullets: json.bullets.slice(0, 10),
      });
    }

    // Fallback
    const sentences = paragraph
      .replace(/\n+/g, ' ')
      .split(/[.!?]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    return success(c, {
      mood: 'curious',
      bullets: sentences.slice(0, 4).map((s) => (s.length > 140 ? `${s.slice(0, 138)}…` : s)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return badRequest(c, message);
  }
});

// POST /ai/prism - Generate idea facets
ai.post('/prism', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { paragraph, postTitle } = body;

  if (!paragraph || typeof paragraph !== 'string') {
    return badRequest(c, 'paragraph is required');
  }

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
    const text = await generateContent(prompt, c.env, { temperature: 0.2 });
    const json = tryParseJson(text);

    if (isRecord(json) && Array.isArray(json.facets)) {
      return success(c, { facets: json.facets.slice(0, 4) });
    }

    // Fallback
    return success(c, {
      facets: [
        { title: '핵심 요점', points: [safeTruncate(paragraph, 140)] },
        { title: '생각해볼 점', points: ['관점 A', '관점 B'] },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return badRequest(c, message);
  }
});

// POST /ai/chain - Generate follow-up questions
ai.post('/chain', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { paragraph, postTitle } = body;

  if (!paragraph || typeof paragraph !== 'string') {
    return badRequest(c, 'paragraph is required');
  }

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
    const text = await generateContent(prompt, c.env, { temperature: 0.2 });
    const json = tryParseJson(text);

    if (isRecord(json) && Array.isArray(json.questions)) {
      return success(c, { questions: json.questions.slice(0, 6) });
    }

    // Fallback
    return success(c, {
      questions: [
        { q: '무엇이 핵심 주장인가?', why: '핵심을 명료화' },
        { q: '어떤 가정이 있는가?', why: '숨은 전제 확인' },
        { q: '적용 예시는?', why: '구체화' },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return badRequest(c, message);
  }
});

// POST /ai/generate - Generic AI generation
ai.post('/generate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { prompt, temperature } = body;

  if (!prompt || typeof prompt !== 'string') {
    return badRequest(c, 'prompt is required');
  }

  try {
    const text = await generateContent(prompt, c.env, {
      temperature: typeof temperature === 'number' ? temperature : 0.2,
    });
    return success(c, { text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return badRequest(c, message);
  }
});

// GET /ai/generate/stream - SSE streaming tokens
ai.get('/generate/stream', async (c) => {
  const url = new URL(c.req.url);
  const q = (url.searchParams.get('prompt') || url.searchParams.get('q') || url.searchParams.get('text') || '').toString();
  const t = Number(url.searchParams.get('temperature'));
  const temperature = Number.isFinite(t) ? t : 0.2;

  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const encoder = new TextEncoder();
  function frame(event?: string, data?: unknown): Uint8Array {
    let lines = '';
    if (event && event.trim()) lines += `event: ${event}\n`;
    if (data !== undefined) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      for (const line of String(payload).split(/\n/)) {
        lines += `data: ${line}\n`;
      }
    }
    lines += '\n';
    return encoder.encode(lines);
  }

  if (!q) {
    // Respond with a minimal SSE error stream
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(frame('error', { message: 'prompt is required' }));
        controller.close();
      },
    });
    return new Response(stream, { headers, status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(frame('open', { type: 'open' }));

        // Generate once then chunk to simulate token stream
        const text = await generateContent(String(q), c.env, { temperature });

        const chunkSize = 80;
        for (let i = 0; i < text.length; i += chunkSize) {
          const token = text.slice(i, Math.min(i + chunkSize, text.length));
          controller.enqueue(frame('token', { token }));
          // Small delay helps UX without overloading event loop
          await new Promise((r) => setTimeout(r, 25));
        }

        controller.enqueue(frame('done', { type: 'done' }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'generation failed';
        controller.enqueue(frame('error', { message }));
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, { headers, status: 200 });
});

// POST /ai/summarize - Summarize article with memo
ai.post('/summarize', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { input, instructions } = body;

  if (!input || typeof input !== 'string') {
    return badRequest(c, 'input is required');
  }

  const prompt = [
    instructions || '다음 내용을 요약해주세요:',
    '',
    safeTruncate(input, 8000),
  ].join('\n');

  try {
    const summary = await generateContent(prompt, c.env, { temperature: 0.2 });
    return success(c, { summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return badRequest(c, message);
  }
});

export default ai;
