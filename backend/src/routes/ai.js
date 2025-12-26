import { Router } from 'express';
import { aiService, tryParseJson } from '../lib/ai-service.js';
import { getLiteLLMClient } from '../lib/litellm-client.js';
import { config } from '../config.js';

const router = Router();

// ============================================================================
// Model List Endpoint - Get available AI models from LiteLLM
// GET /api/v1/ai/models
// ============================================================================

router.get('/models', async (req, res) => {
  try {
    const client = getLiteLLMClient();
    const models = await client.models();
    
    // Get default model from config
    const defaultModel = config.ai?.gateway?.defaultModel || 
                        process.env.AI_DEFAULT_MODEL || 
                        'gemini-1.5-flash';
    
    // Transform models to a cleaner format with categories
    const categorizedModels = categorizeModels(models, defaultModel);
    
    res.json({
      ok: true,
      data: {
        models: categorizedModels,
        default: defaultModel,
        provider: 'litellm',
      },
    });
  } catch (err) {
    console.error('Failed to fetch models:', err.message);
    
    // Return fallback models if LiteLLM is unavailable
    res.json({
      ok: true,
      data: {
        models: getFallbackModels(),
        default: process.env.AI_DEFAULT_MODEL || 'gemini-1.5-flash',
        provider: 'fallback',
        warning: 'Using fallback model list - LiteLLM may be unavailable',
      },
    });
  }
});

/**
 * Categorize models by provider for better UI organization
 */
function categorizeModels(models, defaultModel) {
  const result = [];
  
  for (const model of models) {
    const id = model.id;
    const info = getModelInfo(id);
    
    result.push({
      id,
      name: info.name,
      provider: info.provider,
      description: info.description,
      isDefault: id === defaultModel,
      capabilities: info.capabilities,
    });
  }
  
  // Sort: default first, then by provider
  return result.sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return a.provider.localeCompare(b.provider);
  });
}

/**
 * Get human-readable model info
 */
function getModelInfo(modelId) {
  const modelMap = {
    // Google Gemini
    'gemini-1.5-flash': { 
      name: 'Gemini 1.5 Flash', 
      provider: 'Google', 
      description: 'Fast and efficient',
      capabilities: ['chat', 'vision'],
    },
    'gemini-1.5-pro': { 
      name: 'Gemini 1.5 Pro', 
      provider: 'Google', 
      description: 'Most capable Gemini',
      capabilities: ['chat', 'vision', 'long-context'],
    },
    'gemini-2.0-flash': { 
      name: 'Gemini 2.0 Flash', 
      provider: 'Google', 
      description: 'Latest experimental',
      capabilities: ['chat', 'vision'],
    },
    // OpenAI
    'gpt-4o': { 
      name: 'GPT-4o', 
      provider: 'OpenAI', 
      description: 'Most capable GPT-4',
      capabilities: ['chat', 'vision'],
    },
    'gpt-4o-mini': { 
      name: 'GPT-4o Mini', 
      provider: 'OpenAI', 
      description: 'Fast and affordable',
      capabilities: ['chat', 'vision'],
    },
    'gpt-4-turbo': { 
      name: 'GPT-4 Turbo', 
      provider: 'OpenAI', 
      description: 'High performance',
      capabilities: ['chat', 'vision'],
    },
    'gpt-3.5-turbo': { 
      name: 'GPT-3.5 Turbo', 
      provider: 'OpenAI', 
      description: 'Legacy fast model',
      capabilities: ['chat'],
    },
    // Anthropic
    'claude-3.5-sonnet': { 
      name: 'Claude 3.5 Sonnet', 
      provider: 'Anthropic', 
      description: 'Best for coding',
      capabilities: ['chat', 'vision'],
    },
    'claude-3-haiku': { 
      name: 'Claude 3 Haiku', 
      provider: 'Anthropic', 
      description: 'Fast responses',
      capabilities: ['chat'],
    },
    // Local
    'local': { 
      name: 'Local (Ollama)', 
      provider: 'Local', 
      description: 'Llama 3.2 via Ollama',
      capabilities: ['chat'],
    },
    'local/llama3': { 
      name: 'Llama 3.2', 
      provider: 'Local', 
      description: 'Via Ollama',
      capabilities: ['chat'],
    },
    'local/codellama': { 
      name: 'CodeLlama', 
      provider: 'Local', 
      description: 'Code-optimized',
      capabilities: ['chat', 'code'],
    },
    // Aliases
    'gpt-4.1': { 
      name: 'GPT-4.1 (Alias)', 
      provider: 'Alias', 
      description: 'Maps to Gemini Flash',
      capabilities: ['chat'],
    },
  };
  
  return modelMap[modelId] || {
    name: modelId,
    provider: 'Unknown',
    description: '',
    capabilities: ['chat'],
  };
}

/**
 * Fallback models when LiteLLM is unavailable
 */
function getFallbackModels() {
  return [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', isDefault: true },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
    { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  ];
}

// ============================================================================
// Auto-Chat Endpoint (replaces ai-call-gateway proxy target)
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
      hasGeminiKey: !!config.gemini.apiKey,
      hasOpenRouterKey: !!config.openrouter.apiKey,
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
      model: providerInfo.config[providerInfo.provider]?.model || config.aiServe?.defaultModel,
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
        embeddings: providerInfo.provider === 'litellm',
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

    // Use unified AI service for vision analysis
    try {
      const description = await aiService.vision(base64Data, analysisPrompt, {
        mimeType,
        model: 'gpt-4o', // Vision-capable model
      });

      return res.json({
        ok: true,
        data: {
          description,
          provider: aiService.provider,
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
