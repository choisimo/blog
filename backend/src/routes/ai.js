import { Router } from 'express';
import { aiService, tryParseJson } from '../lib/ai-service.js';
import { config } from '../config.js';
import { queryAll, isD1Configured } from '../lib/d1.js';
import { getAITaskQueue } from '../lib/ai-task-queue.js';
import { isRedisAvailable } from '../lib/redis-client.js';
import { getAIRateLimiter, rateLimitMiddleware } from '../lib/ai-rate-limiter.js';
import { ragSearch } from '../lib/agent/tools/rag-search.js';
import { requireFeature } from '../middleware/featureFlags.js';

const router = Router();

router.use(requireFeature('ai'));

// ============================================================================
// RAG Integration Helper
// ============================================================================

async function searchBlogPosts(query, nResults = 5) {
  try {
    const results = await ragSearch(query, { limit: nResults });
    if (!results || results.length === 0) return null;
    
    return results.map(r => ({
      document: r.content,
      metadata: r.metadata || {},
      score: r.score,
    }));
  } catch (err) {
    console.warn('RAG search error:', err.message);
    return null;
  }
}

/**
 * Detect if user message is asking for blog post recommendations
 * @param {string} message - User message
 * @returns {boolean}
 */
function shouldUseRAG(message) {
  if (!message) return false;
  
  const lowerMsg = message.toLowerCase();
  
  // Korean keywords for blog/post recommendations
  const koreanKeywords = [
    '게시글', '포스트', '글', '추천', '관련', '찾아', '알려', '보여',
    '블로그', '게시물', '작성', '읽', '검색', '주제',
  ];
  
  // English keywords
  const englishKeywords = [
    'post', 'blog', 'article', 'recommend', 'find', 'search',
    'show me', 'related', 'about', 'topic', 'written',
  ];
  
  // Check for keywords
  const hasKoreanKeyword = koreanKeywords.some(kw => lowerMsg.includes(kw));
  const hasEnglishKeyword = englishKeywords.some(kw => lowerMsg.includes(kw));
  
  return hasKoreanKeyword || hasEnglishKeyword;
}

/**
 * Format RAG results as context for LLM
 * @param {Array} results - RAG search results
 * @returns {string} Formatted context
 */
function formatRAGContext(results) {
  if (!results || results.length === 0) return '';
  
  const posts = results.map((r, i) => {
    const meta = r.metadata || {};
    return `${i + 1}. "${meta.title}" (${meta.date || 'no date'})
   - URL: ${meta.url || '/blog/' + meta.slug}
   - Category: ${meta.category || 'N/A'}
   - Tags: ${meta.tags || 'N/A'}
   - Summary: ${r.document?.substring(0, 200) || 'N/A'}`;
  }).join('\n\n');
  
  return `아래는 사용자의 질문과 관련된 블로그 게시글 목록입니다. 이 정보를 바탕으로 답변해주세요:

${posts}

위 게시글들을 참고하여 사용자에게 적절한 게시글을 추천해주세요. 제목, URL, 간단한 설명을 포함하여 안내해주세요.`;
}

// ============================================================================
// Model List Endpoint - Get available AI models (DB-first, with fallbacks)
// GET /api/v1/ai/models
// 
// Priority: 1. Database (ai_models table) -> 2. Static fallback
// ============================================================================

router.get('/models', async (req, res) => {
  const defaultModel = config.ai?.defaultModel ||
    process.env.AI_DEFAULT_MODEL ||
    'gpt-4.1';

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
      console.warn('DB model lookup failed, using fallback list:', dbErr.message);
    }
  }

  // 3. Final fallback - static model list
  res.json({
    ok: true,
    data: {
      models: getFallbackModels(defaultModel),
      default: defaultModel,
      provider: 'fallback',
      warning: 'Using fallback model list - Database may be unavailable',
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
 * Fallback models when DB is unavailable
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
// Auto-Chat Endpoint with RAG Integration
// POST /api/v1/ai/auto-chat
// ============================================================================

router.post('/auto-chat', rateLimitMiddleware(), async (req, res, next) => {
  try {
    const { messages, temperature, maxTokens, model } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { message: 'messages array is required', code: 'INVALID_REQUEST' },
      });
    }

    // Get the last user message for RAG search
    const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')?.content;
    
    // Check if we should use RAG for this query
    let enrichedMessages = [...messages];
    let usedRAG = false;
    
    if (lastUserMessage && shouldUseRAG(lastUserMessage)) {
      // Search for relevant blog posts
      const ragResults = await searchBlogPosts(lastUserMessage, 5);
      
      if (ragResults && ragResults.length > 0) {
        // Format RAG results as context
        const context = formatRAGContext(ragResults);
        
        // Inject context as a system message
        const systemMsg = enrichedMessages.find(m => m.role === 'system');
        if (systemMsg) {
          // Append to existing system message
          systemMsg.content = `${systemMsg.content}\n\n${context}`;
        } else {
          // Add new system message with context
          enrichedMessages.unshift({
            role: 'system',
            content: `당신은 nodove 블로그의 AI 어시스턴트입니다. 사용자의 질문에 친절하게 답변해주세요.\n\n${context}`,
          });
        }
        usedRAG = true;
      }
    }

    // Use unified AI service for chat with optional model selection
    const result = await aiService.chat(enrichedMessages, {
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
        usedRAG, // Let client know if RAG was used
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
      hasApiKey: !!config.ai?.apiKey,
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
      model: providerInfo.config?.defaultModel || config.ai?.defaultModel,
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
        embeddings: false,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /api/v1/ai/queue-stats - Queue statistics
router.get('/queue-stats', async (req, res) => {
  const redisAvailable = await isRedisAvailable();
  
  if (!redisAvailable) {
    return res.json({
      ok: true,
      data: {
        enabled: false,
        message: 'Async queue not available (Redis offline)',
      },
    });
  }

  const queue = getAITaskQueue();
  const stats = await queue.getQueueStats();

  res.json({
    ok: true,
    data: {
      enabled: true,
      asyncMode: process.env.AI_ASYNC_MODE === 'true',
      ...stats,
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /api/v1/ai/dlq - Get Dead Letter Queue tasks
router.get('/dlq', async (req, res) => {
  const redisAvailable = await isRedisAvailable();
  
  if (!redisAvailable) {
    return res.status(503).json({
      ok: false,
      error: { message: 'Redis unavailable', code: 'REDIS_UNAVAILABLE' },
    });
  }

  const count = parseInt(req.query.count, 10) || 10;
  const queue = getAITaskQueue();
  const tasks = await queue.getDLQTasks(count);

  res.json({
    ok: true,
    data: { tasks, count: tasks.length },
  });
});

// POST /api/v1/ai/dlq/:messageId/reprocess - Reprocess a DLQ task
router.post('/dlq/:messageId/reprocess', async (req, res) => {
  const redisAvailable = await isRedisAvailable();
  
  if (!redisAvailable) {
    return res.status(503).json({
      ok: false,
      error: { message: 'Redis unavailable', code: 'REDIS_UNAVAILABLE' },
    });
  }

  const { messageId } = req.params;
  const queue = getAITaskQueue();
  
  try {
    const result = await queue.reprocessDLQTask(messageId);
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(404).json({
      ok: false,
      error: { message: err.message, code: 'DLQ_TASK_NOT_FOUND' },
    });
  }
});

// DELETE /api/v1/ai/dlq - Purge all DLQ tasks
router.delete('/dlq', async (req, res) => {
  const redisAvailable = await isRedisAvailable();
  
  if (!redisAvailable) {
    return res.status(503).json({
      ok: false,
      error: { message: 'Redis unavailable', code: 'REDIS_UNAVAILABLE' },
    });
  }

  const queue = getAITaskQueue();
  const result = await queue.purgeDLQ();
  
  res.json({ ok: true, data: result });
});

// GET /api/v1/ai/rate-limit - Get rate limit status for current client
router.get('/rate-limit', async (req, res) => {
  const limiter = getAIRateLimiter();
  const identifier = req.ip || req.headers['x-forwarded-for'] || 'anonymous';
  const quota = await limiter.getRemainingQuota(identifier);

  res.json({
    ok: true,
    data: {
      ...quota,
      windowMs: limiter.windowMs,
      identifier: identifier.slice(0, 8) + '...',
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

router.post('/vision/analyze', rateLimitMiddleware(), async (req, res, next) => {
  try {
    const { imageUrl, imageBase64, mimeType: inputMimeType, prompt, provider: preferredProvider } = req.body || {};

    let imageData;
    let mimeType;
    let imageType; // 'url' or 'base64'

    // Prefer URL if provided
    // For trusted asset URLs we can pass through directly (more efficient than converting to base64)
    if (imageUrl) {
      const assetsBaseUrl = config.assetsBaseUrl || `${String(config.siteBaseUrl || '').replace(/\/$/, '')}/images`;
      const isTrustedAssetUrl = imageUrl.includes(String(assetsBaseUrl).replace(/^https?:\/\//, ''));
      
      if (isTrustedAssetUrl) {
        // Pass trusted URL directly
        imageData = imageUrl;
        mimeType = inputMimeType || 'image/jpeg';
        imageType = 'url';
      } else {
        // For other URLs, fetch and convert to base64 (for compatibility)
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
router.post('/generate', rateLimitMiddleware(), async (req, res, next) => {
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
