/**
 * AI Gateway Routes
 *
 * 모든 AI 호출은 자체 백엔드 서버(ai-check.nodove.com)를 통해 처리됩니다.
 * 외부 API(Gemini 등)는 백엔드 서버에서 관리하며, Workers에서는 직접 호출하지 않습니다.
 *
 * Endpoints:
 * - POST /gateway/call/auto-chat - AI chat proxy
 * - GET  /gateway/call/health - Health check
 * - GET  /gateway/call/status - Status check
 * - POST /gateway/vision/analyze - Vision analysis
 * - GET  /gateway/vision/health - Health check
 */

import { Hono } from 'hono';
import type { HonoEnv, Env } from '../types';
import { success, badRequest, error, serverError } from '../lib/response';
import {
  getApiBaseUrl,
  getAiServeUrl,
  getAiServeApiKey,
  getAiDefaultModel,
  getAiVisionModel,
} from '../lib/config';
import {
  attachOriginSignatureHeadersForUrl,
  stripOriginSignatureHeaders,
} from '../lib/origin-signature';
import { requireAdmin, requireAuth } from '../middleware/auth';

const gateway = new Hono<HonoEnv>();

// ============================================================================
// Configuration helpers
// ============================================================================

const CONFIG_KEYS = {
  AI_AGENT_BACKEND_URL: 'config:ai_agent_backend_url',
} as const;

const DEFAULT_AI_BACKEND_URL = 'https://blog-b.nodove.com';

function sameOrigin(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

async function getAiAgentBackendUrl(env: Env): Promise<string> {
  const apiBaseUrl = await getApiBaseUrl(env);
  const backendOrigin = env.BACKEND_ORIGIN;
  if (backendOrigin && !sameOrigin(backendOrigin, apiBaseUrl)) {
    return backendOrigin;
  }

  try {
    const kvValue = await env.KV.get(CONFIG_KEYS.AI_AGENT_BACKEND_URL);
    if (kvValue && !sameOrigin(kvValue, apiBaseUrl)) return kvValue;
  } catch {}

  const aiServeUrl = await getAiServeUrl(env);
  if (aiServeUrl && !sameOrigin(aiServeUrl, apiBaseUrl)) return aiServeUrl;

  return backendOrigin || DEFAULT_AI_BACKEND_URL;
}

async function applyBackendAiHeaders(env: Env, headers: Headers): Promise<void> {
  headers.delete('X-Backend-Key');
  headers.delete('X-Internal-Gateway-Key');
  headers.delete('X-API-KEY');
  headers.delete('X-AI-Model');
  headers.delete('X-AI-Vision-Model');
  stripOriginSignatureHeaders(headers);

  if (env.BACKEND_KEY) {
    headers.set('X-Backend-Key', env.BACKEND_KEY);
  }

  const [apiKey, forcedModel, forcedVisionModel] = await Promise.all([
    getAiServeApiKey(env),
    getAiDefaultModel(env),
    getAiVisionModel(env),
  ]);

  if (apiKey) {
    headers.set('X-API-KEY', apiKey);
    headers.set('X-Internal-Gateway-Key', apiKey);
  }
  if (forcedModel) {
    headers.set('X-AI-Model', forcedModel);
    headers.set('X-AI-Model-Source', 'gateway');
  }
  if (forcedVisionModel) {
    headers.set('X-AI-Vision-Model', forcedVisionModel);
    headers.set('X-AI-Vision-Model-Source', 'gateway');
  }
}

// ============================================================================
// AI Call Gateway
// ============================================================================

/**
 * Proxy request to backend AI agent server
 */
async function proxyToBackendAi(request: Request, env: Env, path: string): Promise<Response> {
  const backendUrl = await getAiAgentBackendUrl(env);
  const url = new URL(path, backendUrl);

  // Copy query params
  const originalUrl = new URL(request.url);
  originalUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers = new Headers(request.headers);
  headers.set('Host', new URL(backendUrl).host);
  await applyBackendAiHeaders(env, headers);

  // Remove sensitive headers
  headers.delete('X-Gateway-Caller-Key');
  await attachOriginSignatureHeadersForUrl({
    env,
    headers,
    method: request.method,
    url: url.toString(),
    requestId: headers.get('X-Request-ID') || undefined,
  });

  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.blob();

  const forwarded = new Request(url.toString(), {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  });

  return fetch(forwarded);
}

// POST /gateway/call/auto-chat
gateway.post('/call/auto-chat', requireAuth, async (c) => {
  try {
    const response = await proxyToBackendAi(c.req.raw, c.env, '/api/v1/ai/auto-chat');
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (err) {
    console.error('Backend AI proxy failed:', err);
    return serverError(c, 'AI service unavailable');
  }
});

// GET /gateway/call/health
gateway.get('/call/health', async (c) => {
  const backendUrl = await getAiAgentBackendUrl(c.env);

  return success(c, {
    status: 'ok',
    mode: 'backend',
    backendUrl,
    timestamp: new Date().toISOString(),
  });
});

// GET /gateway/call/status
gateway.get('/call/status', async (c) => {
  try {
    const backendUrl = await getAiAgentBackendUrl(c.env);

    const url = `${backendUrl}/api/v1/ai/status`;
    const headers = new Headers({
      'Content-Type': 'application/json',
    });
    await applyBackendAiHeaders(c.env, headers);
    await attachOriginSignatureHeadersForUrl({
      env: c.env,
      headers,
      method: 'GET',
      url,
    });

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      return success(c, { mode: 'backend', backend: data });
    }
    return success(c, { mode: 'backend', backend: { status: 'error', code: response.status } });
  } catch (err) {
    return success(c, { mode: 'backend', backend: { status: 'unreachable' } });
  }
});

// ============================================================================
// AI Vision Gateway
// ============================================================================

const DEFAULT_VISION_PROMPT = `이 이미지를 분석해주세요. 다음 내용을 간결하게 설명해주세요:
1. 이미지에 보이는 주요 요소들
2. 전체적인 분위기나 맥락
3. 텍스트가 있다면 해당 내용

한국어로 2-3문장으로 간결하게 요약해주세요.`;

/**
 * Fetch image and convert to base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  return { base64, mimeType: contentType };
}

/**
 * Analyze image via backend AI server
 */
async function analyzeWithBackend(
  env: Env,
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const backendUrl = await getAiAgentBackendUrl(env);
  const url = `${backendUrl}/api/v1/ai/vision/analyze`;

  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  const forcedVisionModel = await getAiVisionModel(env);
  await applyBackendAiHeaders(env, headers);
  await attachOriginSignatureHeadersForUrl({
    env,
    headers,
    method: 'POST',
    url,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imageBase64, mimeType, prompt, model: forcedVisionModel }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend vision error: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    ok?: boolean;
    data?: { description?: string; text?: string };
    description?: string;
    text?: string;
  };

  // 다양한 응답 형식 지원
  const description =
    data?.data?.description || data?.data?.text || data?.description || data?.text;

  if (!description) throw new Error('No description in backend response');
  return description;
}

// POST /gateway/vision/analyze
gateway.post('/vision/analyze', requireAuth, async (c) => {
  type VisionRequestBody = {
    imageUrl?: string;
    imageBase64?: string;
    mimeType?: string;
    prompt?: string;
  };
  const body: VisionRequestBody = await c.req.json<VisionRequestBody>().catch(() => ({}));
  const visionModel = await getAiVisionModel(c.env);
  if (!visionModel) {
    return error(c, 'Vision model is not configured', 503, 'VISION_NOT_CONFIGURED');
  }

  let imageBase64: string;
  let mimeType: string;

  // Get image data
  if (body.imageBase64) {
    imageBase64 = body.imageBase64;
    mimeType = body.mimeType || 'image/jpeg';
  } else if (body.imageUrl) {
    try {
      const fetched = await fetchImageAsBase64(body.imageUrl);
      imageBase64 = fetched.base64;
      mimeType = fetched.mimeType;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch image';
      return badRequest(c, message);
    }
  } else {
    return badRequest(c, 'imageUrl or imageBase64 required');
  }

  const prompt = body.prompt || DEFAULT_VISION_PROMPT;

  try {
    const description = await analyzeWithBackend(c.env, imageBase64, mimeType, prompt);
    return success(c, { description, provider: 'backend' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vision analysis failed';
    console.error('Vision analysis failed:', message);
    return serverError(c, message);
  }
});

// GET /gateway/vision/health
gateway.get('/vision/health', async (c) => {
  const backendUrl = await getAiAgentBackendUrl(c.env);
  const visionModel = await getAiVisionModel(c.env);

  return success(c, {
    status: visionModel ? 'ok' : 'not_configured',
    mode: 'backend',
    backendUrl,
    enabled: Boolean(visionModel),
    visionModel: visionModel || null,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Gateway Configuration Admin (for runtime config changes)
// ============================================================================

// GET /gateway/config - Get current gateway configuration
gateway.get('/config', async (c) => {
  const backendUrl = await getAiAgentBackendUrl(c.env);
  const apiKey = await getAiServeApiKey(c.env);
  const [forcedModel, forcedVisionModel] = await Promise.all([
    getAiDefaultModel(c.env),
    getAiVisionModel(c.env),
  ]);

  return success(c, {
    mode: 'backend',
    backendUrl,
    hasApiKey: !!apiKey,
    ai: {
      defaultModel: forcedModel || null,
      visionModel: forcedVisionModel || null,
    },
  });
});

// PUT /gateway/config - Update gateway configuration (admin only)
gateway.put('/config', requireAdmin, async (c) => {
  type ConfigUpdateBody = {
    backendUrl?: string;
  };
  const body: ConfigUpdateBody = await c.req.json<ConfigUpdateBody>().catch(() => ({}));

  try {
    if (body.backendUrl) {
      // Validate URL format
      new URL(body.backendUrl);
      await c.env.KV.put(CONFIG_KEYS.AI_AGENT_BACKEND_URL, body.backendUrl);
    }

    return success(c, { updated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update config';
    return badRequest(c, message);
  }
});

export default gateway;
