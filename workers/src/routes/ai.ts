import { Hono } from 'hono';
import type { Env } from '../types';
import { success, badRequest } from '../lib/response';
import { createAIService, tryParseJson } from '../lib/ai-service';
import type { TaskMode, TaskPayload } from '@blog/shared';

const ai = new Hono<{ Bindings: Env }>();

// ============================================================================
// Task Endpoints (sketch, prism, chain)
// ============================================================================

// POST /ai/sketch - Generate emotional sketch from paragraph
ai.post('/sketch', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { paragraph, postTitle, persona } = body;

  if (!paragraph || typeof paragraph !== 'string') {
    return badRequest(c, 'paragraph is required');
  }

  const aiService = createAIService(c.env);
  const result = await aiService.task('sketch', { paragraph, postTitle, persona });

  if (!result.ok) {
    return badRequest(c, result.error || 'AI task failed');
  }
  return success(c, result.data);
});

// POST /ai/prism - Generate idea facets
ai.post('/prism', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { paragraph, postTitle } = body;

  if (!paragraph || typeof paragraph !== 'string') {
    return badRequest(c, 'paragraph is required');
  }

  const aiService = createAIService(c.env);
  const result = await aiService.task('prism', { paragraph, postTitle });

  if (!result.ok) {
    return badRequest(c, result.error || 'AI task failed');
  }
  return success(c, result.data);
});

// POST /ai/chain - Generate follow-up questions
ai.post('/chain', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { paragraph, postTitle } = body;

  if (!paragraph || typeof paragraph !== 'string') {
    return badRequest(c, 'paragraph is required');
  }

  const aiService = createAIService(c.env);
  const result = await aiService.task('chain', { paragraph, postTitle });

  if (!result.ok) {
    return badRequest(c, result.error || 'AI task failed');
  }
  return success(c, result.data);
});

// ============================================================================
// Generate Endpoints
// ============================================================================

// POST /ai/generate - Generic AI generation
ai.post('/generate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { prompt, temperature } = body;

  if (!prompt || typeof prompt !== 'string') {
    return badRequest(c, 'prompt is required');
  }

  const aiService = createAIService(c.env);
  try {
    const text = await aiService.generate(prompt, {
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
  const q = (
    url.searchParams.get('prompt') ||
    url.searchParams.get('q') ||
    url.searchParams.get('text') ||
    ''
  ).toString();
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

  const aiService = createAIService(c.env);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(frame('open', { type: 'open' }));

        // Generate once then chunk to simulate token stream
        const text = await aiService.generate(String(q), { temperature });

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
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, { headers, status: 200 });
});

// ============================================================================
// Summarize Endpoint
// ============================================================================

// POST /ai/summarize - Summarize article with memo
ai.post('/summarize', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { input, text, instructions } = body;
  const content = input || text;

  if (!content || typeof content !== 'string') {
    return badRequest(c, 'input or text is required');
  }

  const aiService = createAIService(c.env);
  const result = await aiService.summarize(content, { instructions });

  return success(c, result);
});

// ============================================================================
// Chat Endpoint
// ============================================================================

// POST /ai/auto-chat - Chat completion
ai.post('/auto-chat', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { messages, temperature, maxTokens } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return badRequest(c, 'messages array is required');
  }

  const aiService = createAIService(c.env);
  try {
    const result = await aiService.chat(messages, { temperature, maxTokens });
    return success(c, {
      content: result.content,
      model: result.model,
      provider: result.provider,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat failed';
    return badRequest(c, message);
  }
});

// ============================================================================
// Vision Endpoint
// ============================================================================

// POST /ai/vision/analyze - Vision analysis
ai.post('/vision/analyze', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { imageUrl, imageBase64, mimeType, prompt } = body;

  if (!imageBase64 && !imageUrl) {
    return badRequest(c, 'imageBase64 or imageUrl is required');
  }

  const aiService = createAIService(c.env);
  try {
    // If URL provided, we need to fetch and convert (or let backend handle it)
    const imageData = imageBase64 || imageUrl;
    const description = await aiService.vision(imageData, prompt || 'Describe this image', {
      mimeType: mimeType || 'image/jpeg',
    });
    return success(c, { description });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vision analysis failed';
    return badRequest(c, message);
  }
});

// ============================================================================
// Health & Status Endpoints
// ============================================================================

// GET /ai/health - Health check
ai.get('/health', async (c) => {
  const aiService = createAIService(c.env);
  const health = await aiService.health();

  return success(c, {
    status: health.ok ? 'healthy' : 'degraded',
    provider: health.provider,
    backend: health.status,
    timestamp: new Date().toISOString(),
  });
});

// GET /ai/status - Status check
ai.get('/status', async (c) => {
  const aiService = createAIService(c.env);
  const info = await aiService.getProviderInfo();
  const health = await aiService.health();

  return success(c, {
    status: health.ok ? 'ok' : 'degraded',
    provider: info.provider,
    features: info.features,
    timestamp: new Date().toISOString(),
  });
});

export default ai;
