/**
 * n8n Workflow AI Client
 *
 * Unified architecture for AI operations using AIService:
 * 
 * 1. LLM Calls (chat, generate):
 *    - Always use AIService (OpenAI SDK compatible)
 *    - n8n fallback only when AIService is unavailable
 * 
 * 2. Vision Analysis:
 *    - Primary: AIService
 *    - Fallback: n8n webhooks (for R2 URL image processing)
 * 
 * 3. Non-LLM Operations (always via n8n):
 *    - translate: Uses n8n translation workflow
 *    - task: Uses n8n task workflows (sketch, prism, chain, etc.)
 *    - embeddings: Proxied to TEI server via n8n
 * 
 * 4. Workflow Orchestration:
 *    - n8n handles complex multi-step workflows
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                        N8NClient                            │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │                                                             │
 *   │  LLM Calls ──────────────► AIService                       │
 *   │  (chat, generate, vision)       │                          │
 *   │                                 ▼                          │
 *   │                           OpenAI SDK Compatible            │
 *   │                                 │                          │
 *   │                                 ▼                          │
 *   │                           LLM Provider                     │
 *   │                                                             │
 *   │  Non-LLM Calls ─────────► n8n Webhooks (:5678)             │
 *   │  (translate, task, etc.)                                   │
 *   │                                                             │
 *   │  Embeddings ────────────► TEI Server (via n8n or direct)   │
 *   │                                                             │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   import { getN8NClient } from './n8n-client.js';
 *   const client = getN8NClient();
 *   const response = await client.chat([{ role: 'user', content: 'Hello!' }]);
 *   const analysis = await client.vision('https://r2-url/image.jpg', 'Describe this image');
 */

import { getAIService } from './ai-service.js';
import { fetchWithTimeout } from './fetch-utils.js';
import { config } from '../config.js';

/**
 * Structured logger
 */
const logger = {
  _format(level, context, message, data = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'n8n-client',
      ...context,
      message,
      ...data,
    });
  },
  info(ctx, msg, data) { console.log(this._format('info', ctx, msg, data)); },
  warn(ctx, msg, data) { console.warn(this._format('warn', ctx, msg, data)); },
  error(ctx, msg, data) { console.error(this._format('error', ctx, msg, data)); },
  debug(ctx, msg, data) {
    if (process.env.DEBUG_N8N === 'true') {
      console.debug(this._format('debug', ctx, msg, data));
    }
  },
};

// Configuration (from config.js which supports Consul KV with env fallback)
const getN8NBaseUrl = () => 
  config.services?.n8nWebhookUrl || 
  config.services?.n8nBaseUrl || 
  process.env.N8N_WEBHOOK_URL || 
  process.env.N8N_BASE_URL || 
  'http://n8n:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const DEFAULT_MODEL = config.ai?.defaultModel || process.env.AI_DEFAULT_MODEL || 'gemini-1.5-flash';

// Webhook endpoints (configured in n8n)
const WEBHOOKS = {
  chat: '/webhook/ai/chat',
  customLLM: '/webhook/custom-llm/chat',
  generate: '/webhook/ai/generate',
  vision: '/webhook/ai/vision',
  translate: '/webhook/ai/translate',
  task: '/webhook/ai/task',
  embeddings: '/webhook/ai/embeddings',
  health: '/webhook/ai/health',
};

// Timeout settings
const DEFAULT_TIMEOUT = 120000; // 2 minutes
const LONG_TIMEOUT = 300000; // 5 minutes for vision/translation
const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds

// Circuit breaker
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIME = 60000; // 1 minute

/**
 * n8n Webhook AI Client
 * 
 * Uses AIService for LLM calls with n8n fallback for workflow tasks.
 */
export class N8NClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || getN8NBaseUrl();
    this.apiKey = options.apiKey || N8N_API_KEY;
    this.defaultModel = options.model || DEFAULT_MODEL;
    this._aiService = null;
    
    try {
      this._aiService = getAIService();
      logger.info({ operation: 'init' }, 'N8N Client initialized', {
        baseUrl: this.baseUrl,
        defaultModel: this.defaultModel,
        llmBackend: 'ai-service',
      });
    } catch (error) {
      logger.warn({ operation: 'init' }, 'Failed to initialize AIService, using n8n only', {
        error: error.message,
      });
    }

    this._circuitState = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
    };

    this._healthCache = {
      lastCheck: 0,
      isHealthy: false,
      cacheDuration: 30000,
    };
  }

  /**
   * Get request headers
   */
  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * Build webhook URL
   */
  _buildUrl(webhook) {
    const path = WEBHOOKS[webhook] || webhook;
    return `${this.baseUrl}${path}`;
  }

  /**
   * Circuit breaker check
   */
  _isCircuitOpen() {
    if (!this._circuitState.isOpen) return false;

    const now = Date.now();
    if (now - this._circuitState.lastFailure > CIRCUIT_BREAKER_RESET_TIME) {
      this._circuitState.isOpen = false;
      this._circuitState.failures = 0;
      logger.info({ operation: 'circuit_breaker' }, 'Circuit breaker reset');
      return false;
    }
    return true;
  }

  _recordFailure(error) {
    this._circuitState.failures++;
    this._circuitState.lastFailure = Date.now();

    if (this._circuitState.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this._circuitState.isOpen = true;
      logger.warn(
        { operation: 'circuit_breaker' },
        'Circuit breaker opened',
        { failures: this._circuitState.failures, error: error?.message }
      );
    }
  }

  _recordSuccess() {
    if (this._circuitState.failures > 0) {
      this._circuitState.failures = 0;
      this._circuitState.isOpen = false;
    }
  }

  /**
   * Make webhook request
   */
  async _request(webhook, payload, options = {}) {
    const requestId = `n8n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    const url = this._buildUrl(webhook);

    if (this._isCircuitOpen()) {
      logger.warn({ operation: webhook, requestId }, 'Request blocked by circuit breaker');
      throw new Error('n8n service temporarily unavailable (circuit breaker open)');
    }

    logger.debug(
      { operation: webhook, requestId },
      'Starting n8n request',
      { url, payloadSize: JSON.stringify(payload).length }
    );

    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify({
            ...payload,
            _meta: {
              requestId,
              timestamp: new Date().toISOString(),
              source: 'blog-backend',
            },
          }),
        },
        options.timeout || DEFAULT_TIMEOUT
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`n8n webhook failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      this._recordSuccess();

      logger.info(
        { operation: webhook, requestId },
        'n8n request completed',
        { duration, status: response.status }
      );

      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this._recordFailure(error);

      logger.error(
        { operation: webhook, requestId },
        'n8n request failed',
        { duration, error: error.message, url }
      );

      throw error;
    }
  }

  /**
   * Chat completion
   * Routes to AIService when available, falls back to n8n on error.
   * 
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options - { model, temperature, maxTokens, timeout }
   * @returns {Promise<{content: string, model: string, provider: string}>}
   */
  async chat(messages, options = {}) {
    if (this._aiService) {
      try {
        const result = await this._aiService.chat(messages, {
          model: options.model || this.defaultModel,
          timeout: options.timeout,
        });
        
        return {
          content: result.content || '',
          model: result.model || options.model || this.defaultModel,
          provider: 'ai-service',
          sessionId: result.sessionId,
          usage: result.usage,
        };
      } catch (error) {
        logger.warn(
          { operation: 'chat' },
          'AIService chat failed, falling back to n8n',
          { error: error.message }
        );
      }
    }

    const result = await this._request('chat', {
      messages,
      model: options.model || this.defaultModel,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens,
    }, options);

    return {
      content: result.content || result.text || result.response || '',
      model: result.model || options.model || this.defaultModel,
      provider: result.provider || 'n8n',
      usage: result.usage,
    };
  }

/**
 * 
 * @param {*} messages 
 * @param {*} options 
 * @returns 
 */
async customLLMChat(messages, options = {}) {
  return this._call(WEBHOOKS.customLLM, {
    messages,
    model: options.model || 'llama3',
    temperature: options.temperature || 0.7,
  });
}

  /**
   * Simple text generation
   * Routes to AIService when available, falls back to n8n on error.
   * 
   * @param {string} prompt
   * @param {object} options
   * @returns {Promise<string>}
   */
  async generate(prompt, options = {}) {
    if (this._aiService) {
      try {
        return await this._aiService.generate(prompt, {
          model: options.model || this.defaultModel,
          systemPrompt: options.systemPrompt,
          timeout: options.timeout,
        });
      } catch (error) {
        logger.warn(
          { operation: 'generate' },
          'AIService generate failed, falling back to n8n',
          { error: error.message }
        );
      }
    }

    const result = await this._request('generate', {
      prompt,
      model: options.model || this.defaultModel,
      temperature: options.temperature ?? 0.2,
      systemPrompt: options.systemPrompt,
    }, options);

    return result.text || result.content || result.response || '';
  }

  /**
   * Vision analysis
   * 
   * IMPORTANT: Vision always uses n8n workflow (not AIService).
   * This is because images are stored in R2, and n8n workflow can:
   * 1. Fetch the image from R2 URL directly
   * 2. Process with vision-capable models (GPT-4o, Claude, etc.)
   * 3. Return analysis results
   * 
   * Supports both:
   * - R2 URL (preferred): n8n fetches image directly from URL
   * - Base64 data: Legacy support, sent directly to n8n
   * 
   * @param {string} imageData - R2 URL (https://...) or Base64 encoded image
   * @param {string} prompt - Analysis prompt
   * @param {object} options - { mimeType, model, timeout }
   * @returns {Promise<string>}
   */
  async vision(imageData, prompt, options = {}) {
    // Vision ALWAYS uses n8n workflow (no direct AIService)
    // This ensures consistent behavior with R2 image URLs
    
    const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');
    
    const payload = {
      prompt,
      mimeType: options.mimeType || 'image/jpeg',
      model: options.model || 'gpt-4o',
    };

    if (isUrl) {
      // Send URL - n8n will fetch the image
      payload.imageUrl = imageData;
      payload.type = 'url';
    } else {
      // Send base64 data directly (legacy support)
      payload.image = imageData;
      payload.type = 'base64';
    }

    logger.debug(
      { operation: 'vision' },
      'Vision analysis request',
      { type: payload.type, model: payload.model, promptLength: prompt?.length }
    );

    const result = await this._request('vision', payload, { 
      timeout: options.timeout || LONG_TIMEOUT 
    });

    return result.description || result.text || result.content || result.analysis || '';
  }

  /**
   * Translation
   * @param {object} payload - { title, description, content, sourceLang, targetLang }
   * @param {object} options
   * @returns {Promise<{title: string, description: string, content: string}>}
   */
  async translate(payload, options = {}) {
    const result = await this._request('translate', {
      ...payload,
      model: options.model,
    }, { timeout: options.timeout || LONG_TIMEOUT });

    return {
      title: result.title || payload.title,
      description: result.description || payload.description || '',
      content: result.content || payload.content,
      isAiGenerated: true,
    };
  }

  /**
   * Structured task (sketch, prism, chain, summary)
   * @param {string} mode - Task type
   * @param {object} payload - Task-specific data
   * @param {object} options
   * @returns {Promise<{ok: boolean, data: object}>}
   */
  async task(mode, payload, options = {}) {
    try {
      const result = await this._request('task', {
        mode,
        payload,
        temperature: options.temperature,
      }, options);

      return {
        ok: true,
        data: result.data || result,
        source: 'n8n',
      };
    } catch (error) {
      logger.warn(
        { operation: 'task', mode },
        'Task failed, returning fallback',
        { error: error.message }
      );

      return {
        ok: true,
        data: this._getFallbackData(mode, payload),
        source: 'fallback',
        _fallback: true,
      };
    }
  }

  /**
   * Get fallback data for task
   */
  _getFallbackData(mode, payload) {
    const text = payload.paragraph || payload.content || payload.prompt || '';
    const sentences = text
      .replace(/\n+/g, ' ')
      .split(/[.!?]\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    switch (mode) {
      case 'sketch':
        return {
          mood: 'curious',
          bullets: sentences.slice(0, 4).map(s =>
            s.length > 140 ? `${s.slice(0, 138)}…` : s
          ),
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
        return {
          summary: text.slice(0, 300) + (text.length > 300 ? '...' : ''),
        };
      case 'catalyst':
        return {
          suggestions: [
            { idea: '다른 관점에서 접근', reason: '새로운 시각 제공' },
          ],
        };
      default:
        return { text };
    }
  }

  /**
   * Embeddings generation
   * @param {string|string[]} input
   * @param {object} options
   * @returns {Promise<number[][]>}
   */
  async embeddings(input, options = {}) {
    const result = await this._request('embeddings', {
      input: Array.isArray(input) ? input : [input],
      model: options.model || 'text-embedding-ada-002',
    }, options);

    return result.embeddings || result.data || [];
  }

  /**
   * Streaming generation (via SSE or chunked)
   * Routes to AIService when available.
   * Note: Both n8n and AIService use simulated streaming (chunked response).
   */
  async *stream(prompt, options = {}) {
    if (this._aiService) {
      try {
        for await (const chunk of this._aiService.stream(prompt, options)) {
          yield chunk;
        }
        return;
      } catch (error) {
        logger.warn(
          { operation: 'stream' },
          'AIService stream failed, falling back to n8n',
          { error: error.message }
        );
      }
    }

    const text = await this.generate(prompt, options);

    const chunkSize = 80;
    for (let i = 0; i < text.length; i += chunkSize) {
      yield text.slice(i, Math.min(i + chunkSize, text.length));
      await new Promise(r => setTimeout(r, 25));
    }
  }

  /**
   * Health check
   * Returns combined health status for n8n and AIService.
   */
  async health(force = false) {
    const now = Date.now();

    if (!force && now - this._healthCache.lastCheck < this._healthCache.cacheDuration) {
      return {
        ok: this._healthCache.isHealthy,
        cached: true,
        status: this._healthCache.status,
      };
    }

    const healthResult = {
      ok: false,
      n8n: { ok: false },
      aiService: { ok: false },
    };

    try {
      const response = await fetchWithTimeout(
        this._buildUrl('health'),
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );

      healthResult.n8n.ok = response.ok;
      if (response.ok) {
        try {
          healthResult.n8n.status = await response.json();
        } catch {
          healthResult.n8n.status = { status: 'ok' };
        }
      }
    } catch (error) {
      healthResult.n8n.error = error.message;
    }

    if (this._aiService) {
      try {
        const aiServiceHealth = await this._aiService.health(force);
        healthResult.aiService.ok = aiServiceHealth.ok;
        healthResult.aiService.status = aiServiceHealth.status;
      } catch (error) {
        healthResult.aiService.error = error.message;
      }
    }

    healthResult.ok = healthResult.n8n.ok || healthResult.aiService.ok;

    this._healthCache.isHealthy = healthResult.ok;
    this._healthCache.lastCheck = now;
    this._healthCache.status = healthResult;

    return healthResult;
  }

  /**
   * List available models (from n8n config)
   */
  async models() {
    try {
      const result = await this._request('health', { action: 'list-models' }, {
        timeout: HEALTH_CHECK_TIMEOUT,
      });
      return result.models || [];
    } catch {
      // Return fallback models
      return [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
      ];
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState() {
    return {
      isOpen: this._circuitState.isOpen,
      failures: this._circuitState.failures,
      lastFailure: this._circuitState.lastFailure,
      threshold: CIRCUIT_BREAKER_THRESHOLD,
      resetTime: CIRCUIT_BREAKER_RESET_TIME,
    };
  }

  /**
   * Get current backend configuration
   */
  getBackendInfo() {
    return {
      n8nUrl: this.baseUrl,
      aiServiceEnabled: !!this._aiService,
      aiServiceProvider: this._aiService?.getProviderInfo?.()?.provider || null,
      defaultModel: this.defaultModel,
    };
  }
}

// Singleton
let _client = null;

/**
 * Get the default n8n client instance
 */
export function getN8NClient() {
  if (!_client) {
    _client = new N8NClient();
  }
  return _client;
}

/**
 * Legacy compatibility: generateContent
 */
export async function generateContent(prompt, options = {}) {
  const client = getN8NClient();
  return client.generate(prompt, options);
}

/**
 * Try to parse JSON from AI response
 */
export function tryParseJson(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch { /* continue */ }

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch { /* continue */ }
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch { /* continue */ }
  }

  return null;
}

export default N8NClient;
