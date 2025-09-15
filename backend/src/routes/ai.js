import { Router } from 'express';
import { generateContent, tryParseJson } from '../lib/gemini.js';

const router = Router();

function safeTruncate(s, n) {
  if (!s) return s;
  return s.length > n ? `${s.slice(0, n)}\n…(truncated)` : s;
}

function isRecord(v) {
  return v !== null && typeof v === 'object';
}

router.post('/summarize', async (req, res, next) => {
  try {
    const { text, input, instructions } = req.body || {};
    const contentText = text || input;
    if (!contentText) {
      return res.status(400).json({ ok: false, error: 'Missing text' });
    }
    const prompt = instructions
      ? `${instructions}\n\n---\n\n${contentText}`
      : `Summarize the following content in Korean, concise but faithful to key points.\n\n${contentText}`;

    const summary = await generateContent(prompt, { temperature: 0.2 });
    return res.json({ ok: true, data: { summary } });
  } catch (err) {
    return next(err);
  }
});

router.post('/sketch', async (req, res, next) => {
  try {
    const { paragraph, postTitle, persona } = req.body || {};
    if (!paragraph || typeof paragraph !== 'string')
      return res
        .status(400)
        .json({ ok: false, error: 'paragraph is required' });

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
      const text = await generateContent(prompt, { temperature: 0.3 });
      const json = tryParseJson(text);
      if (
        isRecord(json) &&
        Array.isArray(json.bullets) &&
        typeof json.mood === 'string'
      ) {
        return res.json({
          ok: true,
          data: { mood: json.mood, bullets: json.bullets.slice(0, 10) },
        });
      }
      throw new Error('Invalid JSON');
    } catch (_) {
      const sentences = (paragraph || '')
        .replace(/\n+/g, ' ')
        .split(/[.!?]\s+/)
        .map(s => s.trim())
        .filter(Boolean);
      return res.json({
        ok: true,
        data: {
          mood: 'curious',
          bullets: sentences
            .slice(0, 4)
            .map(s => (s.length > 140 ? `${s.slice(0, 138)}…` : s)),
        },
      });
    }
  } catch (err) {
    return next(err);
  }
});

router.post('/prism', async (req, res, next) => {
  try {
    const { paragraph, postTitle } = req.body || {};
    if (!paragraph || typeof paragraph !== 'string')
      return res
        .status(400)
        .json({ ok: false, error: 'paragraph is required' });

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
      const text = await generateContent(prompt, { temperature: 0.2 });
      const json = tryParseJson(text);
      if (isRecord(json) && Array.isArray(json.facets)) {
        return res.json({
          ok: true,
          data: { facets: json.facets.slice(0, 4) },
        });
      }
      throw new Error('Invalid JSON');
    } catch (_) {
      return res.json({
        ok: true,
        data: {
          facets: [
            { title: '핵심 요점', points: [safeTruncate(paragraph, 140)] },
            { title: '생각해볼 점', points: ['관점 A', '관점 B'] },
          ],
        },
      });
    }
  } catch (err) {
    return next(err);
  }
});

router.post('/chain', async (req, res, next) => {
  try {
    const { paragraph, postTitle } = req.body || {};
    if (!paragraph || typeof paragraph !== 'string')
      return res
        .status(400)
        .json({ ok: false, error: 'paragraph is required' });

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
      const text = await generateContent(prompt, { temperature: 0.2 });
      const json = tryParseJson(text);
      if (isRecord(json) && Array.isArray(json.questions)) {
        return res.json({
          ok: true,
          data: { questions: json.questions.slice(0, 6) },
        });
      }
      throw new Error('Invalid JSON');
    } catch (_) {
      return res.json({
        ok: true,
        data: {
          questions: [
            { q: '무엇이 핵심 주장인가?', why: '핵심을 명료화' },
            { q: '어떤 가정이 있는가?', why: '숨은 전제 확인' },
            { q: '적용 예시는?', why: '구체화' },
          ],
        },
      });
    }
  } catch (err) {
    return next(err);
  }
});

export default router;

// Raw generate endpoint for AI Memo and other generic prompts
// Request: { prompt: string, temperature?: number }
// Response: { ok: true, data: { text: string } }
router.post('/generate', async (req, res, next) => {
  try {
    const { prompt, temperature } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ ok: false, error: 'prompt is required' });
    }
    const text = await generateContent(String(prompt), {
      temperature: typeof temperature === 'number' ? temperature : 0.2,
    });
    return res.json({ ok: true, data: { text } });
  } catch (err) {
    return next(err);
  }
});
