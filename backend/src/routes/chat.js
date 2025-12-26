import { Router } from 'express';
import { getVASClient, generateContent, tryParseJson } from '../lib/ai-serve.js';

const router = Router();

// In-memory session storage (for simplicity - use Redis in production)
const sessions = new Map();

/**
 * Helper: Create a new session
 */
function createSession(title = '') {
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessions.set(sessionId, {
    id: sessionId,
    title: title || `Session ${sessionId.slice(-6)}`,
    messages: [],
    createdAt: new Date().toISOString(),
  });
  return sessionId;
}

/**
 * Helper: Get session
 */
function getSession(sessionId) {
  return sessions.get(sessionId);
}

/**
 * Helper: Validate task mode
 */
const VALID_TASK_MODES = ['sketch', 'prism', 'chain', 'catalyst', 'summary', 'custom'];
function isValidTaskMode(mode) {
  return VALID_TASK_MODES.includes(mode);
}

/**
 * Helper: Build prompt for task
 */
function buildTaskPrompt(mode, payload) {
  const { paragraph, content, postTitle, persona, prompt } = payload;
  const text = paragraph || content || prompt || '';
  const title = postTitle || '';

  switch (mode) {
    case 'sketch':
      return {
        prompt: [
          'You are a helpful writing companion. Return STRICT JSON only matching the schema.',
          '{"mood":"string","bullets":["string", "string", "..."]}',
          '',
          `Persona: ${persona || 'default'}`,
          `Post: ${title.slice(0, 120)}`,
          'Paragraph:',
          text.slice(0, 1600),
          '',
          'Task: Capture the emotional sketch. Select a concise mood (e.g., curious, excited, skeptical) and 3-6 short bullets in the original language of the text.',
        ].join('\n'),
        temperature: 0.3,
      };

    case 'prism':
      return {
        prompt: [
          'Return STRICT JSON only for idea facets.',
          '{"facets":[{"title":"string","points":["string","string"]}]}',
          `Post: ${title.slice(0, 120)}`,
          'Paragraph:',
          text.slice(0, 1600),
          '',
          'Task: Provide 2-3 facets (titles) with 2-4 concise points each, in the original language.',
        ].join('\n'),
        temperature: 0.2,
      };

    case 'chain':
      return {
        prompt: [
          'Return STRICT JSON only for tail questions.',
          '{"questions":[{"q":"string","why":"string"}]}',
          `Post: ${title.slice(0, 120)}`,
          'Paragraph:',
          text.slice(0, 1600),
          '',
          'Task: Generate 3-5 short follow-up questions and a brief why for each, in the original language.',
        ].join('\n'),
        temperature: 0.2,
      };

    case 'summary':
      return {
        prompt: `Summarize the following content in Korean, concise but faithful to key points.\n\n${text}`,
        temperature: 0.2,
      };

    case 'catalyst':
      return {
        prompt: [
          'Return STRICT JSON for catalyst suggestions.',
          '{"suggestions":[{"idea":"string","reason":"string"}]}',
          `Post: ${title.slice(0, 120)}`,
          'Content:',
          text.slice(0, 1600),
          '',
          'Task: Provide 2-4 creative suggestions or alternative perspectives, in the original language.',
        ].join('\n'),
        temperature: 0.4,
      };

    case 'custom':
    default:
      return {
        prompt: text,
        temperature: 0.2,
      };
  }
}

/**
 * Helper: Get fallback data for task
 */
function getFallbackData(mode, payload) {
  const text = payload.paragraph || payload.content || payload.prompt || '';
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  switch (mode) {
    case 'sketch':
      return {
        mood: 'curious',
        bullets: sentences.slice(0, 4).map((s) => (s.length > 140 ? `${s.slice(0, 138)}...` : s)),
      };
    case 'prism':
      return {
        facets: [
          { title: '핵심 요점', points: [text.slice(0, 140)] },
          { title: '생각해볼 점', points: ['관점 A', '관점 B'] },
        ],
      };
    case 'chain':
      return {
        questions: [
          { q: '무엇이 핵심 주장인가?', why: '핵심을 명료화' },
          { q: '어떤 가정이 있는가?', why: '숨은 전제 확인' },
          { q: '적용 예시는?', why: '구체화' },
        ],
      };
    case 'summary':
      return { summary: text.slice(0, 300) + (text.length > 300 ? '...' : '') };
    case 'catalyst':
      return {
        suggestions: [
          { idea: '다른 관점에서 접근', reason: '새로운 시각 제공' },
        ],
      };
    default:
      return { text: 'Unable to process request' };
  }
}

/**
 * POST /api/v1/chat/session
 * Create new chat session
 */
router.post('/session', async (req, res, next) => {
  try {
    const { title } = req.body || {};
    const sessionId = createSession(title);
    
    return res.json({
      ok: true,
      data: { sessionID: sessionId, id: sessionId },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/chat/session/:sessionId/message
 * Send chat message (SSE streaming)
 */
router.post('/session/:sessionId/message', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { parts, context, model } = req.body || {};

    // Get or create session
    let session = getSession(sessionId);
    if (!session) {
      const newId = createSession();
      session = getSession(newId);
    }

    // Extract text from parts
    let userMessage = '';
    if (Array.isArray(parts)) {
      userMessage = parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('\n');
    } else if (typeof parts === 'string') {
      userMessage = parts;
    }

    if (!userMessage.trim()) {
      return res.status(400).json({ ok: false, error: 'No message content' });
    }

    // Add context if available
    const pageContext = context?.page;
    if (pageContext?.url || pageContext?.title) {
      userMessage = `[Context: ${pageContext.title || ''} - ${pageContext.url || ''}]\n\n${userMessage}`;
    }

    // Store message
    session.messages.push({ role: 'user', content: userMessage });

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (data) => {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      res.write(`data: ${payload}\n\n`);
    };

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    try {
      // Generate response via VAS with optional model selection
      const client = getVASClient();
      const result = await client.chat(session.messages, { model });

      if (closed) return;

      // Stream the response
      const text = result.content || '';
      
      // Send text in chunks
      const chunkSize = 50;
      for (let i = 0; i < text.length; i += chunkSize) {
        if (closed) break;
        const chunk = text.slice(i, i + chunkSize);
        send({ type: 'text', text: chunk });
        await new Promise((r) => setTimeout(r, 20));
      }

      // Store assistant response
      session.messages.push({ role: 'assistant', content: text });

      // Send done event
      send({ type: 'done' });
    } catch (err) {
      console.error('Chat streaming error:', err);
      send({ type: 'error', error: err.message || 'Chat failed' });
    }

    res.end();
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/chat/session/:sessionId/task
 * Execute inline AI task (sketch, prism, chain, etc.)
 */
router.post('/session/:sessionId/task', async (req, res, next) => {
  try {
    const { mode, payload, context, prompt: legacyPrompt } = req.body || {};

    // Validate mode
    const taskMode = isValidTaskMode(mode) ? mode : 'custom';
    const taskPayload = payload || {};

    // Legacy compatibility
    if (legacyPrompt && legacyPrompt.trim() && taskMode === 'custom') {
      taskPayload.prompt = legacyPrompt;
    }

    // Validate content
    const content = taskPayload.paragraph || taskPayload.content || taskPayload.prompt || '';
    if (!content.trim()) {
      return res.status(400).json({ ok: false, error: 'No content provided for task' });
    }

    try {
      // Build prompt
      const { prompt, temperature } = buildTaskPrompt(taskMode, taskPayload);

      // Execute via VAS
      const text = await generateContent(prompt, { temperature });

      // Parse response based on mode
      let data;
      if (taskMode === 'custom' || taskMode === 'summary') {
        data = taskMode === 'summary' ? { summary: text } : { text };
      } else {
        const json = tryParseJson(text);
        if (json) {
          data = json;
        } else {
          throw new Error('Invalid JSON response');
        }
      }

      return res.json({
        ok: true,
        data,
        mode: taskMode,
        source: 'vas',
      });
    } catch (err) {
      console.warn('Task execution failed, returning fallback:', err.message);
      const fallbackData = getFallbackData(taskMode, taskPayload);
      return res.json({
        ok: true,
        data: fallbackData,
        mode: taskMode,
        source: 'fallback',
        _fallback: true,
      });
    }
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/chat/aggregate
 * Aggregate multiple session summaries
 */
router.post('/aggregate', async (req, res, next) => {
  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ ok: false, error: 'prompt is required' });
    }

    const systemPrompt = [
      '다음 입력에는 여러 대화 세션의 요약과 사용자의 통합 질문이 함께 포함되어 있습니다.',
      '먼저 세션 요약들을 충분히 이해한 뒤, 사용자의 요청에 따라 전체를 한 번에 통합하여 답변해 주세요.',
      '- 공통된 핵심 아이디어',
      '- 서로 다른 관점이나 긴장 지점',
      '- 다음 액션/실천 아이디어',
      '를 중심으로 한국어로 정리해 주세요.',
      '',
      '---',
      '',
      prompt.trim(),
    ].join('\n');

    const text = await generateContent(systemPrompt, { temperature: 0.2 });
    return res.json({ ok: true, data: { text } });
  } catch (err) {
    return next(err);
  }
});

export default router;
