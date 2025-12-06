import { Router } from 'express';
import { generateContent, tryParseJson, getAIServeClient } from '../lib/ai-serve.js';
import { config } from '../config.js';

const router = Router();

// ============================================================================
// Auto-Chat Endpoint (replaces ai-call-gateway proxy target)
// POST /api/v1/ai/auto-chat
// ============================================================================

router.post('/auto-chat', async (req, res, next) => {
  try {
    const { messages, temperature, maxTokens } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'messages array is required', code: 'INVALID_REQUEST' },
      });
    }

    // Use AI Serve client for chat
    const client = getAIServeClient();
    const result = await client.chat(messages, {
      // temperature and maxTokens can be passed if ai-serve supports them
    });

    return res.json({
      ok: true,
      data: {
        content: result.content,
        model: result.model,
        provider: result.provider,
      },
    });
  } catch (err) {
    console.error('auto-chat error:', err);
    return next(err);
  }
});

// GET /api/v1/ai/health - Health check
router.get('/health', async (req, res) => {
  const client = getAIServeClient();
  const aiServeHealth = await client.health();

  res.json({
    ok: true,
    data: {
      status: aiServeHealth.ok ? 'healthy' : 'degraded',
      aiServe: aiServeHealth,
      // Legacy fallback status
      hasGeminiKey: !!config.gemini.apiKey,
      hasOpenRouterKey: !!config.openrouter.apiKey,
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /api/v1/ai/status - Status check
router.get('/status', async (req, res) => {
  const client = getAIServeClient();
  let providers = null;

  try {
    providers = await client.providers();
  } catch {
    // AI Serve might not be available
  }

  res.json({
    ok: true,
    data: {
      status: 'ok',
      model: config.aiServe.defaultModel,
      provider: config.aiServe.defaultProvider,
      aiServe: {
        baseUrl: config.aiServe.baseUrl,
        providers: providers?.providers || [],
      },
      features: {
        chat: true,
        vision: true,
        summarize: true,
        generate: true,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================================
// Vision Analysis Endpoint (replaces ai-vision-gateway)
// POST /api/v1/ai/vision/analyze
// ============================================================================

const DEFAULT_VISION_PROMPT = `이 이미지를 분석해주세요. 다음 내용을 간결하게 설명해주세요:
1. 이미지에 보이는 주요 요소들
2. 전체적인 분위기나 맥락
3. 텍스트가 있다면 해당 내용

한국어로 2-3문장으로 간결하게 요약해주세요.`;

/**
 * Fetch image from URL and convert to base64
 */
async function fetchImageAsBase64(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return { base64, mimeType: contentType };
}

router.post('/vision/analyze', async (req, res, next) => {
  try {
    const { imageUrl, imageBase64, mimeType: inputMimeType, prompt, provider: preferredProvider } = req.body || {};

    let base64Data;
    let mimeType;

    // Get image data from either base64 or URL
    if (imageBase64) {
      base64Data = imageBase64;
      mimeType = inputMimeType || 'image/jpeg';
    } else if (imageUrl) {
      try {
        const fetched = await fetchImageAsBase64(imageUrl);
        base64Data = fetched.base64;
        mimeType = fetched.mimeType;
      } catch (err) {
        return res.status(400).json({
          ok: false,
          error: { message: err.message || 'Failed to fetch image', code: 'IMAGE_FETCH_ERROR' },
        });
      }
    } else {
      return res.status(400).json({
        ok: false,
        error: { message: 'imageUrl or imageBase64 required', code: 'INVALID_REQUEST' },
      });
    }

    const analysisPrompt = prompt || DEFAULT_VISION_PROMPT;

    // Use AI Serve for vision analysis
    const client = getAIServeClient();
    try {
      const description = await client.vision(base64Data, mimeType, analysisPrompt, {
        model: 'gpt-4o', // Vision-capable model
      });

      return res.json({
        ok: true,
        data: {
          description,
          provider: 'ai-serve',
        },
      });
    } catch (err) {
      console.error('AI Serve vision failed:', err.message);
      return res.status(502).json({
        ok: false,
        error: {
          message: err.message || 'Vision analysis failed',
          code: 'VISION_ERROR',
        },
      });
    }
  } catch (err) {
    console.error('vision/analyze error:', err);
    return next(err);
  }
});

// GET /api/v1/ai/vision/health - Vision health check
router.get('/vision/health', async (req, res) => {
  const client = getAIServeClient();
  const aiServeHealth = await client.health();

  res.json({
    ok: true,
    data: {
      status: aiServeHealth.ok ? 'ok' : 'degraded',
      providers: {
        'ai-serve': aiServeHealth.ok,
        // Legacy fallback
        gemini: !!config.gemini.apiKey,
        openrouter: !!config.openrouter.apiKey,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================================
// Existing Endpoints (summarize, sketch, prism, chain, generate)
// ============================================================================

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

// ============================================================================
// Raw Generate Endpoints
// ============================================================================

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

// SSE streaming endpoint. Accepts GET with query `prompt` (or `q`) and optional `temperature`.
// Streams the generated text in small chunks as 'token' events and completes with 'done'.
router.get('/generate/stream', async (req, res, next) => {
  try {
    const q = (req.query.prompt || req.query.q || req.query.text || '').toString();
    const t = Number(req.query.temperature);
    const temperature = Number.isFinite(t) ? t : 0.2;

    if (!q) {
      res.writeHead(400, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message: 'prompt is required' })}\n\n`);
      return res.end();
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event, data) => {
      if (event) res.write(`event: ${event}\n`);
      if (data !== undefined) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        // split by newlines to avoid very long lines
        const lines = String(payload).split(/\n/);
        for (const line of lines) {
          res.write(`data: ${line}\n`);
        }
      }
      res.write(`\n`);
    };

    send('open', { type: 'open' });

    let closed = false;
    const onClose = () => {
      closed = true;
      clearInterval(ping);
      try {
        res.end();
      } catch {}
    };
    req.on('close', onClose);

    const ping = setInterval(() => {
      try {
        send('ping', {});
      } catch {
        onClose();
      }
    }, 25000);

    // Generate full text, then chunk-stream to client
    let text = '';
    try {
      text = await generateContent(String(q), { temperature });
    } catch (err) {
      send('error', { message: err?.message || 'generation failed' });
      return onClose();
    }

    const chunkSize = 80;
    let idx = 0;
    const total = text.length;

    const tick = () => {
      if (closed) return;
      if (idx >= total) {
        send('done', { type: 'done' });
        return onClose();
      }
      const next = text.slice(idx, Math.min(idx + chunkSize, total));
      idx += chunkSize;
      send('token', { token: next });
      setTimeout(tick, 25);
    };

    tick();
  } catch (err) {
    return next(err);
  }
});

export default router;
