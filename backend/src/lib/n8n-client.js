/**
 * n8n Workflow AI Client
 *
 * Routes all AI operations through n8n webhooks for centralized management.
 * n8n handles provider selection, fallbacks, rate limiting, and logging.
 *
 * Architecture:
 *   Backend API -> n8n Webhook -> AI Provider (via n8n nodes)
 *
 * Benefits:
 *   - Visual workflow management (no code changes for AI routing)
 *   - Easy provider switching via n8n UI
 *   - Built-in retry, error handling, and logging
 *   - Centralized prompt management
 *   - Easy A/B testing of different models/prompts
 *
 * Usage:
 *   import { getN8NClient } from './n8n-client.js';
 *   const client = getN8NClient();
 *   const response = await client.chat([{ role: 'user', content: 'Hello!' }]);
 */

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

// Configuration
const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || process.env.N8N_BASE_URL || 'http://n8n:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'gemini-1.5-flash';

// Webhook endpoints (configured in n8n)
const WEBHOOKS = {
  chat: '/webhook/ai/chat',
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
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`n8n request timeout after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * n8n Webhook AI Client
 */
export class N8NClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || N8N_BASE_URL;
    this.apiKey = options.apiKey || N8N_API_KEY;
    this.defaultModel = options.model || DEFAULT_MODEL;

    // Circuit breaker state
    this._circuitState = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
    };

    // Health cache
    this._healthCache = {
      lastCheck: 0,
      isHealthy: false,
      cacheDuration: 30000, // 30 seconds
    };

    logger.info({ operation: 'init' }, 'N8N Client initialized', {
      baseUrl: this.baseUrl,
      defaultModel: this.defaultModel,
    });
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
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options - { model, temperature, maxTokens, timeout }
   * @returns {Promise<{content: string, model: string, provider: string}>}
   */
  async chat(messages, options = {}) {
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
   * Simple text generation
   * @param {string} prompt
   * @param {object} options
   * @returns {Promise<string>}
   */
  async generate(prompt, options = {}) {
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
   * @param {string} imageData - Base64 or URL
   * @param {string} prompt
   * @param {object} options
   * @returns {Promise<string>}
   */
  async vision(imageData, prompt, options = {}) {
    const result = await this._request('vision', {
      image: imageData,
      prompt,
      mimeType: options.mimeType || 'image/jpeg',
      model: options.model || 'gpt-4o',
    }, { timeout: options.timeout || LONG_TIMEOUT });

    return result.description || result.text || result.content || '';
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
   * Note: n8n webhook doesn't support native streaming,
   * so we return an async generator that chunks the response
   */
  async *stream(prompt, options = {}) {
    // Generate full text first
    const text = await this.generate(prompt, options);

    // Stream in chunks
    const chunkSize = 80;
    for (let i = 0; i < text.length; i += chunkSize) {
      yield text.slice(i, Math.min(i + chunkSize, text.length));
      await new Promise(r => setTimeout(r, 25));
    }
  }

  /**
   * Health check
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

    try {
      const response = await fetchWithTimeout(
        this._buildUrl('health'),
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );

      const isHealthy = response.ok;
      let status = {};

      if (isHealthy) {
        try {
          status = await response.json();
        } catch {
          status = { status: 'ok' };
        }
      }

      this._healthCache.isHealthy = isHealthy;
      this._healthCache.lastCheck = now;
      this._healthCache.status = status;

      return { ok: isHealthy, status };
    } catch (error) {
      this._healthCache.isHealthy = false;
      this._healthCache.lastCheck = now;

      logger.warn({ operation: 'health' }, 'Health check failed', { error: error.message });
      return { ok: false, error: error.message };
    }
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
