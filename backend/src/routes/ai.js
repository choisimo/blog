import { Router } from 'express';
import { aiService, tryParseJson } from '../lib/ai-service.js';
import { getN8NClient } from '../lib/n8n-client.js';
import { config } from '../config.js';
// DB access for dynamic model management
import { queryAll, isD1Configured } from '../lib/d1.js';

const router = Router();

// ============================================================================
// Model List Endpoint - Get available AI models (DB-first, with fallbacks)
// GET /api/v1/ai/models
// 
// Priority: 1. Database (ai_models table) -> 2. n8n -> 3. Static fallback
// ============================================================================

router.get('/models', async (req, res) => {
  const defaultModel = config.ai?.gateway?.defaultModel || 
                      process.env.AI_DEFAULT_MODEL || 
                      'gemini-1.5-flash';

  // 1. Try Database first (Source of Truth)
  if (isD1Configured()) {
    try {
      const sql = `
        SELECT 
          m.id, m.model_name, m.display_name, m.description, 
          m.supports_vision, m.supports_streaming, m.supports_function_calling,
          m.context_window, m.priority,
          p.name as provider_name, p.display_name as provider_display_name
        FROM ai_models m
        LEFT JOIN ai_providers p ON m.provider_id = p.id
        WHERE m.is_enabled = 1
        ORDER BY m.priority DESC, m.display_name ASC
      `;
      
      const dbModels = await queryAll(sql);

      if (dbModels.length > 0) {
        const formattedModels = dbModels.map(m => ({
          id: m.id,
          name: m.display_name || m.model_name,
          provider: m.provider_display_name || m.provider_name || 'Unknown',
          description: m.description || '',
          isDefault: m.id === defaultModel,
          capabilities: buildCapabilities(m),
          contextWindow: m.context_window,
        }));

        // Sort: default first, then by priority (already sorted by DB), then by provider
        formattedModels.sort((a, b) => {
          if (a.isDefault) return -1;
          if (b.isDefault) return 1;
          return 0; // preserve DB order (by priority)
        });

        return res.json({
          ok: true,
          data: {
            models: formattedModels,
            default: defaultModel,
            provider: 'database',
          },
        });
      }
    } catch (dbErr) {
      console.warn('DB model lookup failed, falling back to n8n:', dbErr.message);
    }
  }

  // 2. Fallback to n8n client
  try {
    const client = getN8NClient();
    const models = await client.models();
    
    // Format n8n models
    const n8nModels = models.map(m => ({
      id: m.id,
      name: m.name || m.id,
      provider: m.provider || 'n8n',
      description: 'Loaded from n8n workflow',
      isDefault: m.id === defaultModel,
      capabilities: ['chat'],
    }));

    // Sort: default first
    n8nModels.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });

    return res.json({
      ok: true,
      data: {
        models: n8nModels,
        default: defaultModel,
        provider: 'n8n',
      },
    });
  } catch (err) {
    console.error('Failed to fetch models from n8n:', err.message);
  }

  // 3. Final fallback - static model list
  res.json({
    ok: true,
    data: {
      models: getFallbackModels(defaultModel),
      default: defaultModel,
      provider: 'fallback',
      warning: 'Using fallback model list - Database and n8n may be unavailable',
    },
  });
});

/**
 * Build capabilities array from DB model flags
 */
function buildCapabilities(model) {
  const caps = ['chat']; // All models support chat
  if (model.supports_vision) caps.push('vision');
  if (model.supports_streaming) caps.push('streaming');
  if (model.supports_function_calling) caps.push('function-calling');
  if (model.context_window >= 100000) caps.push('long-context');
  return caps;
}

/**
 * Fallback models when DB and n8n are unavailable
 */
function getFallbackModels(defaultModel) {
  const fallbackList = [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', capabilities: ['chat', 'vision'] },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', capabilities: ['chat', 'vision', 'long-context'] },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', capabilities: ['chat', 'vision'] },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', capabilities: ['chat', 'vision'] },
    { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', capabilities: ['chat', 'vision'] },
  ];
  
  return fallbackList.map(m => ({
    ...m,
    isDefault: m.id === defaultModel,
  }));
}

// ============================================================================
// Auto-Chat Endpoint
// POST /api/v1/ai/auto-chat
// ============================================================================

router.post('/auto-chat', async (req, res, next) => {
  try {
    const { messages, temperature, maxTokens, model } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'messages array is required', code: 'INVALID_REQUEST' },
      });
    }

    // Use unified AI service for chat with optional model selection
    const result = await aiService.chat(messages, {
      temperature,
      maxTokens,
      model, // Pass selected model to AI service
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
  const healthResult = await aiService.health();
  const providerInfo = aiService.getProviderInfo();

  res.json({
    ok: true,
    data: {
      status: healthResult.ok ? 'healthy' : 'degraded',
      provider: providerInfo.provider,
      health: healthResult,
      // Legacy fallback status
      hasGeminiKey: !!config.ai?.providers?.gemini,
      hasOpenRouterKey: false, // OpenRouter not configured
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /api/v1/ai/status - Status check
router.get('/status', async (req, res) => {
  const providerInfo = aiService.getProviderInfo();
  const healthResult = await aiService.health();

  res.json({
    ok: true,
    data: {
      status: healthResult.ok ? 'ok' : 'degraded',
      provider: providerInfo.provider,
      model: providerInfo.config[providerInfo.provider]?.model || config.ai?.gateway?.defaultModel,
      aiService: {
        provider: providerInfo.provider,
        config: providerInfo.config,
      },
      features: {
        chat: true,
        vision: true,
        summarize: true,
        generate: true,
        stream: true,
        embeddings: providerInfo.provider === 'n8n',
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================================
// Vision Analysis Endpoint
// POST /api/v1/ai/vision/analyze
// ============================================================================

const DEFAULT_VISION_PROMPT = `이 이미지를 분석해주세요. 다음 내용을 간결하게 설명해주세요:
1. 이미지에 보이는 주요 요소들
2. 전체적인 분위기나 맥락
3. 텍스트가 있다면 해당 내용

한국어로 2-3문장으로 간결하게 요약해주세요.`;
/**
 * Fetch image from URL with SSRF protection and size limits
 */
async function fetchImageAsBase64(imageUrl) {
  const parsedUrl = new URL(imageUrl);
  
  // 1. 프로토콜 제한 (http, https만 허용)
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Invalid protocol');
  }

  // 2. (옵션) 내부망 IP 접근 차단 로직 추가 권장 (프로덕션 환경)
  // 예: ipaddr.js 라이브러리 등을 사용하여 private IP 대역 차단

  const response = await fetch(imageUrl, {
    // 3. 타임아웃 설정 (AbortSignal)
    signal: AbortSignal.timeout(5000), 
    // 4. 리다이렉트 제한 (무한 루프 방지)
    redirect: 'error' 
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  // 5. 콘텐츠 크기 제한 (예: 10MB)
  const MAX_SIZE = 10 * 1024 * 1024;
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_SIZE) {
    throw new Error('Image too large');
  }

  // 스트림으로 읽으면서 크기 체크 (Content-Length가 없는 경우 대비)
  const buffer = await response.arrayBuffer(); 
  if (buffer.byteLength > MAX_SIZE) {
    throw new Error('Image too large');
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const base64 = Buffer.from(buffer).toString('base64');

  return { base64, mimeType: contentType };
}

router.post('/vision/analyze', async (req, res, next) => {
  try {
    const { imageUrl, imageBase64, mimeType: inputMimeType, prompt, provider: preferredProvider } = req.body || {};

    let imageData;
    let mimeType;
    let imageType; // 'url' or 'base64'

    // Prefer URL if provided (n8n will fetch from R2 directly)
    // This is more efficient than converting to base64
    if (imageUrl) {
      // Check if it's an R2 URL or other accessible URL
      const isR2Url = imageUrl.includes('assets-b.nodove.com') || 
                      imageUrl.includes('r2.cloudflarestorage.com');
      
      if (isR2Url) {
        // Pass R2 URL directly - n8n workflow will fetch
        imageData = imageUrl;
        mimeType = inputMimeType || 'image/jpeg';
        imageType = 'url';
      } else {
        // For non-R2 URLs, fetch and convert to base64 (for compatibility)
        try {
          const fetched = await fetchImageAsBase64(imageUrl);
          imageData = fetched.base64;
          mimeType = fetched.mimeType;
          imageType = 'base64';
        } catch (err) {
          return res.status(400).json({
            ok: false,
            error: { message: err.message || 'Failed to fetch image', code: 'IMAGE_FETCH_ERROR' },
          });
        }
      }
    } else if (imageBase64) {
      imageData = imageBase64;
      mimeType = inputMimeType || 'image/jpeg';
      imageType = 'base64';
    } else {
      return res.status(400).json({
        ok: false,
        error: { message: 'imageUrl or imageBase64 required', code: 'INVALID_REQUEST' },
      });
    }

    const analysisPrompt = prompt || DEFAULT_VISION_PROMPT;

    // Use unified AI service for vision analysis
    // aiService.vision handles both URL and base64 formats
    try {
      const description = await aiService.vision(imageData, analysisPrompt, {
        mimeType,
        model: 'gpt-4o', // Vision-capable model
      });

      return res.json({
        ok: true,
        data: {
          description,
          provider: aiService.provider,
          imageType, // Let client know how image was processed
        },
      });
    } catch (err) {
      console.error('Vision analysis failed:', err.message);
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
  const healthResult = await aiService.health();
  const providerInfo = aiService.getProviderInfo();

  res.json({
    ok: true,
    data: {
      status: healthResult.ok ? 'ok' : 'degraded',
      provider: providerInfo.provider,
      providers: {
        [providerInfo.provider]: healthResult.ok,
        // Legacy fallback
        gemini: !!config.ai?.providers?.gemini,
        openrouter: false, // OpenRouter not configured
      },
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================================================
// Existing Endpoints (summarize, sketch, prism, chain, generate)
// ============================================================================

router.post('/summarize', async (req, res, next) => {
  try {
    const { text, input, instructions } = req.body || {};
    const contentText = text || input;
    if (!contentText) {
      return res.status(400).json({ ok: false, error: 'Missing text' });
    }

    const result = await aiService.task('summary', {
      content: contentText,
      prompt: instructions,
    }, { temperature: 0.2 });

    return res.json({ ok: true, data: { summary: result.data?.summary || result.data?.text || contentText.slice(0, 200) } });
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

    const result = await aiService.task('sketch', {
      paragraph,
      postTitle,
      persona,
    });

    if (result.ok && result.data) {
      return res.json({
        ok: true,
        data: {
          mood: result.data.mood,
          bullets: (result.data.bullets || []).slice(0, 10),
        },
      });
    }

    throw new Error('Invalid response');
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

    const result = await aiService.task('prism', {
      paragraph,
      postTitle,
    });

    if (result.ok && result.data) {
      return res.json({
        ok: true,
        data: { facets: (result.data.facets || []).slice(0, 4) },
      });
    }

    throw new Error('Invalid response');
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

    const result = await aiService.task('chain', {
      paragraph,
      postTitle,
    });

    if (result.ok && result.data) {
      return res.json({
        ok: true,
        data: { questions: (result.data.questions || []).slice(0, 6) },
      });
    }

    throw new Error('Invalid response');
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
    const text = await aiService.generate(String(prompt), {
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
      if (closed) return; // Prevent double-close
      closed = true;
      clearInterval(ping);
      try {
        if (!res.writableEnded) {
          res.end();
        }
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

    // Use streaming from AIService
    try {
      for await (const chunk of aiService.stream(String(q), { temperature })) {
        if (closed) break;
        send('token', { token: chunk });
      }
      if (!closed) {
        send('done', { type: 'done' });
      }
      return onClose();
    } catch (err) {
      send('error', { message: err?.message || 'generation failed' });
      return onClose();
    }
  } catch (err) {
    return next(err);
  }
});

export default router;
