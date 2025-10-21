import { withCors, type Env } from './middleware/cors';
import { generateContent, tryParseJson } from './lib/gemini';

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    status: init?.status || 200,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return withCors(async (req, _env) => {
      try {
        const url = new URL(req.url);
        if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

        if (url.pathname === '/ai/generate' && req.method === 'POST') {
          const body = await req.json().catch(() => ({}));
          const { prompt, temperature } = body as { prompt?: string; temperature?: number };
          if (!prompt || typeof prompt !== 'string') return json({ error: 'prompt is required' }, { status: 400 });
          const text = await generateContent(prompt, env, { temperature });
          return json({ text });
        }

        if (url.pathname === '/ai/sketch' && req.method === 'POST') {
          const body = await req.json().catch(() => ({}));
          const { paragraph, postTitle, persona } = body as Record<string, unknown>;
          if (!paragraph || typeof paragraph !== 'string') return json({ error: 'paragraph is required' }, { status: 400 });

          const prompt = [
            'You are a helpful writing companion. Return STRICT JSON only matching the schema.',
            '{"mood":"string","bullets":["string","string","..."]}',
            `Persona: ${typeof persona === 'string' ? persona : 'default'}`,
            `Post: ${typeof postTitle === 'string' ? postTitle.slice(0, 120) : ''}`,
            'Paragraph:',
            String(paragraph).slice(0, 1600),
            'Task: Capture the emotional sketch. Select a concise mood and 3-6 bullets in the original language.',
          ].join('\n');

          const text = await generateContent(prompt, env, { temperature: 0.3 });
          const jsonParsed = tryParseJson(text);
          if (jsonParsed && typeof jsonParsed === 'object') return json(jsonParsed);

          return json({ mood: 'curious', bullets: [String(paragraph).slice(0, 140)] });
        }

        if (url.pathname === '/ai/prism' && req.method === 'POST') {
          const body = await req.json().catch(() => ({}));
          const { paragraph, postTitle } = body as Record<string, unknown>;
          if (!paragraph || typeof paragraph !== 'string') return json({ error: 'paragraph is required' }, { status: 400 });

          const prompt = [
            'Return STRICT JSON only for idea facets.',
            '{"facets":[{"title":"string","points":["string","string"]}]}',
            `Post: ${typeof postTitle === 'string' ? postTitle.slice(0, 120) : ''}`,
            'Paragraph:',
            String(paragraph).slice(0, 1600),
            'Task: Provide 2-3 facets with 2-4 concise points each, in the original language.',
          ].join('\n');

          const text = await generateContent(prompt, env, { temperature: 0.2 });
          const jsonParsed = tryParseJson(text);
          if (jsonParsed && typeof jsonParsed === 'object') return json(jsonParsed);

          return json({ facets: [{ title: '핵심 요점', points: [String(paragraph).slice(0, 140)] }] });
        }

        if (url.pathname === '/ai/chain' && req.method === 'POST') {
          const body = await req.json().catch(() => ({}));
          const { paragraph, postTitle } = body as Record<string, unknown>;
          if (!paragraph || typeof paragraph !== 'string') return json({ error: 'paragraph is required' }, { status: 400 });

          const prompt = [
            'Return STRICT JSON only for tail questions.',
            '{"questions":[{"q":"string","why":"string"}]}',
            `Post: ${typeof postTitle === 'string' ? postTitle.slice(0, 120) : ''}`,
            'Paragraph:',
            String(paragraph).slice(0, 1600),
            'Task: Generate 3-5 short follow-up questions with brief why, original language.',
          ].join('\n');

          const text = await generateContent(prompt, env, { temperature: 0.2 });
          const jsonParsed = tryParseJson(text);
          if (jsonParsed && typeof jsonParsed === 'object') return json(jsonParsed);

          return json({
            questions: [
              { q: '무엇이 핵심 주장인가?', why: '핵심을 명료화' },
              { q: '어떤 가정이 있는가?', why: '숨은 전제 확인' },
              { q: '적용 예시는?', why: '구체화' },
            ],
          });
        }

        return json({ error: 'Not Found' }, { status: 404 });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Internal Error';
        return json({ error: msg }, { status: 500 });
      }
    })(request, env);
  },
};
