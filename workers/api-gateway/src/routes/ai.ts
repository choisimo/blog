import { Hono } from 'hono';
import type { Context } from 'hono';
import type { HonoEnv } from '../types';
import { success, badRequest, error } from '../lib/response';
import { createAIService, tryParseJson } from '../lib/ai-service';
import { AI_TEMPERATURES, STREAMING } from '../config/defaults';
import type { TaskMode, TaskPayload } from '../lib/prompts';
import { markArtifactItemsRead } from '../lib/ai-artifacts';
import { requireAuth } from '../middleware/auth';
import {
  getCachedIdempotencyResponse,
  idempotentJson,
  releaseIdempotencyClaim,
} from '../lib/idempotency';

const ai = new Hono<HonoEnv>();

const AI_JSON_MAX_BYTES = 128 * 1024;
const AI_PROMPT_MAX_CHARS = 16000;
const AI_CHAT_MAX_MESSAGES = 32;
const AI_CHAT_MAX_CONTENT_CHARS = 32000;
const AI_VISION_MAX_IMAGE_CHARS = 8 * 1024 * 1024;
const AI_DEFAULT_TIMEOUT_MS = 30000;
const AI_VISION_TIMEOUT_MS = 45000;
const AI_RATE_WINDOW_SECONDS = 60;
const AI_DEFAULT_RATE_LIMIT = 30;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getAuthenticatedSubject(c: Context<HonoEnv>): string {
  return c.get('user')?.sub || 'unknown';
}

function rejectOversizeJson(c: Context<HonoEnv>, maxBytes = AI_JSON_MAX_BYTES): Response | null {
  const contentLength = c.req.header('content-length');
  if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
    return error(c, 'AI request body too large', 413, 'PAYLOAD_TOO_LARGE');
  }
  return null;
}

async function enforceAiRateLimit(c: Context<HonoEnv>, routeKey: string): Promise<Response | null> {
  const kv = c.env.KV;
  if (!kv) return null;

  const limit = parsePositiveInt(c.env.AI_RATE_LIMIT_PER_MINUTE, AI_DEFAULT_RATE_LIMIT);
  const subject = getAuthenticatedSubject(c);
  const key = `ratelimit:ai:${routeKey}:${subject}`;
  const currentCount = Number.parseInt((await kv.get(key)) || '0', 10);

  if (currentCount >= limit) {
    console.warn('[ai] rate limit exceeded', { routeKey, subject });
    return error(c, 'Too many AI requests', 429, 'RATE_LIMITED');
  }

  await kv.put(key, String(currentCount + 1), { expirationTtl: AI_RATE_WINDOW_SECONDS });
  return null;
}

function validatePrompt(prompt: unknown, field = 'prompt'): string | null {
  if (!prompt || typeof prompt !== 'string') {
    return `${field} is required`;
  }
  if (prompt.length > AI_PROMPT_MAX_CHARS) {
    return `${field} is too large`;
  }
  return null;
}

function validateChatMessages(messages: unknown): string | null {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'messages array is required';
  }
  if (messages.length > AI_CHAT_MAX_MESSAGES) {
    return 'messages array is too large';
  }
  const totalChars = messages.reduce((sum, message) => {
    if (!message || typeof message !== 'object') return sum + AI_CHAT_MAX_CONTENT_CHARS + 1;
    const content = (message as { content?: unknown }).content;
    return sum + (typeof content === 'string' ? content.length : AI_CHAT_MAX_CONTENT_CHARS + 1);
  }, 0);
  return totalChars > AI_CHAT_MAX_CONTENT_CHARS ? 'messages content is too large' : null;
}

// ============================================================================
// Task Endpoints (sketch, prism, chain)
// ============================================================================

// POST /ai/sketch - Generate emotional sketch from paragraph
ai.post('/sketch', requireAuth, async (c) => {
  const sizeError = rejectOversizeJson(c);
  if (sizeError) return sizeError;
  const rateLimit = await enforceAiRateLimit(c, 'sketch');
  if (rateLimit) return rateLimit;
  const body = await c.req.json().catch(() => ({}));
  const { paragraph, postTitle, persona } = body;

  const promptError = validatePrompt(paragraph, 'paragraph');
  if (promptError) {
    return badRequest(c, promptError);
  }

  const aiService = createAIService(c.env);
  const result = await aiService.task('sketch', { paragraph, postTitle, persona });

  if (!result.ok) {
    return badRequest(c, result.error || 'AI task failed');
  }
  return success(c, result.data);
});

// POST /ai/prism - Generate idea facets
ai.post('/prism', requireAuth, async (c) => {
  const sizeError = rejectOversizeJson(c);
  if (sizeError) return sizeError;
  const rateLimit = await enforceAiRateLimit(c, 'prism');
  if (rateLimit) return rateLimit;
  const body = await c.req.json().catch(() => ({}));
  const { paragraph, postTitle } = body;

  const promptError = validatePrompt(paragraph, 'paragraph');
  if (promptError) {
    return badRequest(c, promptError);
  }

  const aiService = createAIService(c.env);
  const result = await aiService.task('prism', { paragraph, postTitle });

  if (!result.ok) {
    return badRequest(c, result.error || 'AI task failed');
  }
  return success(c, result.data);
});

// POST /ai/chain - Generate follow-up questions
ai.post('/chain', requireAuth, async (c) => {
  const sizeError = rejectOversizeJson(c);
  if (sizeError) return sizeError;
  const rateLimit = await enforceAiRateLimit(c, 'chain');
  if (rateLimit) return rateLimit;
  const body = await c.req.json().catch(() => ({}));
  const { paragraph, postTitle } = body;

  const promptError = validatePrompt(paragraph, 'paragraph');
  if (promptError) {
    return badRequest(c, promptError);
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
ai.post('/generate', requireAuth, async (c) => {
  const sizeError = rejectOversizeJson(c);
  if (sizeError) return sizeError;
  const rateLimit = await enforceAiRateLimit(c, 'generate');
  if (rateLimit) return rateLimit;
  const body = await c.req.json().catch(() => ({}));
  const { prompt, temperature } = body;

  const promptError = validatePrompt(prompt);
  if (promptError) {
    return badRequest(c, promptError);
  }

  const idempotencyPayload = { prompt, temperature };
  const cached = await getCachedIdempotencyResponse(c, 'ai.generate', idempotencyPayload);
  if (cached) return cached;

  const aiService = createAIService(c.env);
  try {
    const text = await aiService.generate(prompt, {
      temperature: typeof temperature === 'number' ? temperature : AI_TEMPERATURES.GENERATE,
      timeout: AI_DEFAULT_TIMEOUT_MS,
    });
    return idempotentJson(c, 'ai.generate', idempotencyPayload, 200, {
      ok: true,
      data: { text },
    });
  } catch (err) {
    await releaseIdempotencyClaim(c, 'ai.generate', idempotencyPayload).catch(() => undefined);
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return badRequest(c, message);
  }
});

// GET /ai/generate/stream - SSE streaming tokens
ai.get('/generate/stream', requireAuth, async (c) => {
  const url = new URL(c.req.url);
  const q = (
    url.searchParams.get('prompt') ||
    url.searchParams.get('q') ||
    url.searchParams.get('text') ||
    ''
  ).toString();
  const t = Number(url.searchParams.get('temperature'));
  const temperature = Number.isFinite(t) ? t : AI_TEMPERATURES.GENERATE;

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
  if (q.length > AI_PROMPT_MAX_CHARS) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(frame('error', { message: 'prompt is too large' }));
        controller.close();
      },
    });
    return new Response(stream, { headers, status: 400 });
  }

  const rateLimit = await enforceAiRateLimit(c, 'generate-stream');
  if (rateLimit) return rateLimit;

  const aiService = createAIService(c.env);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(frame('open', { type: 'open' }));

        const text = await aiService.generate(String(q), { temperature, timeout: AI_DEFAULT_TIMEOUT_MS });

        const chunkSize = STREAMING.CHUNK_SIZE;
        for (let i = 0; i < text.length; i += chunkSize) {
          const token = text.slice(i, Math.min(i + chunkSize, text.length));
          controller.enqueue(frame('token', { token }));
          await new Promise((r) => setTimeout(r, STREAMING.CHUNK_DELAY));
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
ai.post('/summarize', requireAuth, async (c) => {
  const sizeError = rejectOversizeJson(c);
  if (sizeError) return sizeError;
  const rateLimit = await enforceAiRateLimit(c, 'summarize');
  if (rateLimit) return rateLimit;
  const body = await c.req.json().catch(() => ({}));
  const { input, text, instructions } = body;
  const content = input || text;

  const promptError = validatePrompt(content, 'input or text');
  if (promptError) {
    return badRequest(c, promptError);
  }

  const aiService = createAIService(c.env);
  const result = await aiService.summarize(content, { instructions });

  return success(c, result);
});

// ============================================================================
// Chat Endpoint
// ============================================================================

// POST /ai/auto-chat - Chat completion
ai.post('/auto-chat', requireAuth, async (c) => {
  const sizeError = rejectOversizeJson(c);
  if (sizeError) return sizeError;
  const rateLimit = await enforceAiRateLimit(c, 'auto-chat');
  if (rateLimit) return rateLimit;
  const body = await c.req.json().catch(() => ({}));
  const { messages, temperature, maxTokens } = body;

  const messagesError = validateChatMessages(messages);
  if (messagesError) {
    return badRequest(c, messagesError);
  }

  const idempotencyPayload = { messages, temperature, maxTokens };
  const cached = await getCachedIdempotencyResponse(c, 'ai.auto-chat', idempotencyPayload);
  if (cached) return cached;

  const aiService = createAIService(c.env);
  try {
    const result = await aiService.chat(messages, {
      temperature,
      maxTokens,
      timeout: AI_DEFAULT_TIMEOUT_MS,
    });
    return idempotentJson(c, 'ai.auto-chat', idempotencyPayload, 200, {
      ok: true,
      data: {
        content: result.content,
        model: result.model,
        provider: result.provider,
      },
    });
  } catch (err) {
    await releaseIdempotencyClaim(c, 'ai.auto-chat', idempotencyPayload).catch(() => undefined);
    const message = err instanceof Error ? err.message : 'Chat failed';
    return badRequest(c, message);
  }
});

// ============================================================================
// Vision Endpoint
// ============================================================================

// POST /ai/vision/analyze - Vision analysis
ai.post('/vision/analyze', requireAuth, async (c) => {
  const sizeError = rejectOversizeJson(c, AI_VISION_MAX_IMAGE_CHARS + AI_JSON_MAX_BYTES);
  if (sizeError) return sizeError;
  const rateLimit = await enforceAiRateLimit(c, 'vision-analyze');
  if (rateLimit) return rateLimit;
  const body = await c.req.json().catch(() => ({}));
  const { imageUrl, imageBase64, mimeType, prompt } = body;

  if (!imageBase64 && !imageUrl) {
    return badRequest(c, 'imageBase64 or imageUrl is required');
  }
  if (typeof imageBase64 === 'string' && imageBase64.length > AI_VISION_MAX_IMAGE_CHARS) {
    return error(c, 'imageBase64 is too large', 413, 'PAYLOAD_TOO_LARGE');
  }
  if (prompt && typeof prompt === 'string' && prompt.length > AI_PROMPT_MAX_CHARS) {
    return badRequest(c, 'prompt is too large');
  }

  const idempotencyPayload = { imageUrl, imageBase64, mimeType, prompt };
  const cached = await getCachedIdempotencyResponse(c, 'ai.vision.analyze', idempotencyPayload);
  if (cached) return cached;

  const aiService = createAIService(c.env);
  try {
    // If URL provided, we need to fetch and convert (or let backend handle it)
    const imageData = imageBase64 || imageUrl;
    const description = await aiService.vision(imageData, prompt || 'Describe this image', {
      mimeType: mimeType || 'image/jpeg',
      timeout: AI_VISION_TIMEOUT_MS,
    });
    return idempotentJson(c, 'ai.vision.analyze', idempotencyPayload, 200, {
      ok: true,
      data: { description },
    });
  } catch (err) {
    await releaseIdempotencyClaim(c, 'ai.vision.analyze', idempotencyPayload).catch(() => undefined);
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

ai.post('/artifacts/read', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    userKey?: string;
    sessionId?: string;
    artifactType?: string;
    scopeKey?: string;
    logicalKey?: string;
    itemHash?: string;
  };

  const userKey = body.userKey || body.sessionId;
  if (!userKey || !body.artifactType || !body.scopeKey || !body.logicalKey || !body.itemHash) {
    return badRequest(c, 'userKey, artifactType, scopeKey, logicalKey, and itemHash are required');
  }

  await markArtifactItemsRead(c.env.DB, {
    userKey,
    artifactType: body.artifactType,
    scopeKey: body.scopeKey,
    items: [{ logicalKey: body.logicalKey, itemHash: body.itemHash }],
  });

  return success(c, { updated: true });
});

ai.post('/artifacts/read/batch', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    userKey?: string;
    sessionId?: string;
    artifactType?: string;
    scopeKey?: string;
    items?: Array<{ logicalKey?: string; itemHash?: string }>;
  };

  const userKey = body.userKey || body.sessionId;
  const items = Array.isArray(body.items)
    ? body.items.filter((item): item is { logicalKey: string; itemHash: string } =>
        Boolean(item?.logicalKey && item?.itemHash)
      )
    : [];

  if (!userKey || !body.artifactType || !body.scopeKey || items.length === 0) {
    return badRequest(c, 'userKey, artifactType, scopeKey, and items are required');
  }

  await markArtifactItemsRead(c.env.DB, {
    userKey,
    artifactType: body.artifactType,
    scopeKey: body.scopeKey,
    items,
  });

  return success(c, { updated: true, count: items.length });
});

export default ai;
