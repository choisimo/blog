/**
 * OpenAI SDK Compatible Client Service
 *
 * Uses OpenAI SDK to communicate with OpenAI-compatible AI servers.
 * This allows using any OpenAI-compatible endpoint (OpenAI, custom gateways, etc.)
 *
 * Architecture:
 *   Blog Backend -> OpenAI SDK -> OpenAI-compatible server -> LLM
 *
 * Configuration (priority order):
 *   1. Consul KV (if USE_CONSUL=true) - services/ai/url
 *   2. Environment variables - OPENAI_API_BASE_URL, AI_SERVER_URL
 *   3. Default fallback (OpenAI public endpoint)
 *
 * Usage:
 *   import { getOpenAIClient, openaiChat, openaiGenerate } from './openai-client.service.js';
 *
 *   // Using the client directly
 *   const client = getOpenAIClient();
 *   const response = await client.chat.completions.create({
 *     model: 'gpt-4.1',
 *     messages: [{ role: 'user', content: 'Hello!' }]
 *   });
 *
 *   // Using helper functions
 *   const result = await openaiChat([{ role: 'user', content: 'Hello!' }]);
 *   const text = await openaiGenerate('Summarize this text...');
 */

import OpenAI from 'openai';
import { config } from '../../config.js';
import {
  AI_MODELS,
  TIMEOUTS,
  CIRCUIT_BREAKER,
  OPENAI_CLIENT,
} from '../../config/constants.js';

// ============================================================================
// Configuration (from config.js which supports Consul KV with env fallback)
// ============================================================================

const getOpenAIBaseUrl = () => (
  config.ai?.baseUrl
  || process.env.OPENAI_API_BASE_URL
  || process.env.AI_SERVER_URL
  || 'https://api.openai.com/v1'
);
const OPENAI_API_KEY = config.ai?.apiKey
  || process.env.AI_API_KEY
  || process.env.OPENAI_API_KEY
  || 'sk-placeholder';
const OPENAI_DEFAULT_MODEL = config.ai?.defaultModel
  || process.env.AI_DEFAULT_MODEL
  || AI_MODELS.DEFAULT;
const getEmbeddingBaseUrl = () => (
  config.rag?.embeddingUrl
  || process.env.AI_EMBEDDING_URL
  || process.env.AI_SERVER_URL
  || process.env.OPENAI_API_BASE_URL
  || 'https://api.openai.com/v1'
);
const getEmbeddingModel = () => (
  config.rag?.embeddingModel
  || process.env.AI_EMBED_MODEL
  || 'text-embedding-3-small'
);

// Timeout settings
const DEFAULT_TIMEOUT = TIMEOUTS.DEFAULT; // 2 minutes
const LONG_TIMEOUT = TIMEOUTS.LONG; // 5 minutes

// Circuit breaker settings
const CIRCUIT_BREAKER_THRESHOLD = CIRCUIT_BREAKER.THRESHOLD;
const CIRCUIT_BREAKER_RESET_TIME = CIRCUIT_BREAKER.RESET_TIME; // 30 seconds

// ============================================================================
// Logger
// ============================================================================

const logger = {
  _format(level, context, message, data = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'openai-compat-client',
      ...context,
      message,
      ...data,
    });
  },
  info(ctx, msg, data) { console.log(this._format('info', ctx, msg, data)); },
  warn(ctx, msg, data) { console.warn(this._format('warn', ctx, msg, data)); },
  error(ctx, msg, data) { console.error(this._format('error', ctx, msg, data)); },
  debug(ctx, msg, data) {
    if (process.env.DEBUG_OPENAI === 'true') {
      console.debug(this._format('debug', ctx, msg, data));
    }
  },
};

// ============================================================================
// OpenAI Compatible Client Class
// ============================================================================

export class OpenAICompatClient {
  constructor(options = {}) {
    let baseURL = options.baseUrl || getOpenAIBaseUrl();
    if (!baseURL.endsWith('/v1')) {
      baseURL = baseURL.replace(/\/$/, '') + '/v1';
    }

    this.baseUrl = baseURL;
    this.apiKey = options.apiKey || OPENAI_API_KEY;
    this.defaultModel = options.model || OPENAI_DEFAULT_MODEL;

    // Initialize OpenAI client
    this._openai = new OpenAI({
      baseURL: this.baseUrl,
      apiKey: this.apiKey,
      timeout: options.timeout || DEFAULT_TIMEOUT,
      maxRetries: OPENAI_CLIENT.MAX_RETRIES,
    });

    // Circuit breaker state
    this._circuitState = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
    };

    // Health check cache
    this._healthCache = {
      lastCheck: 0,
      isHealthy: false,
      cacheDuration: 10000,
      status: null,
    };

    logger.info(
      { operation: 'init' },
      'OpenAICompatClient initialized',
      { baseUrl: this.baseUrl, defaultModel: this.defaultModel }
    );
  }

  /**
   * Get the underlying OpenAI client
   */
  get openai() {
    return this._openai;
  }

  /**
   * Check if circuit breaker is open
   */
  _isCircuitOpen() {
    if (!this._circuitState.isOpen) return false;

    const now = Date.now();
    if (now - this._circuitState.lastFailure > CIRCUIT_BREAKER_RESET_TIME) {
      this._circuitState.isOpen = false;
      this._circuitState.failures = 0;
      return false;
    }

    return true;
  }

  /**
   * Record a failure for circuit breaker
   */
  _recordFailure() {
    this._circuitState.failures++;
    this._circuitState.lastFailure = Date.now();

    if (this._circuitState.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this._circuitState.isOpen = true;
      logger.warn(
        { operation: 'circuit_breaker' },
        'Circuit breaker opened',
        { failures: this._circuitState.failures }
      );
    }
  }

  /**
   * Record a success, reset circuit breaker
   */
  _recordSuccess() {
    this._circuitState.failures = 0;
    this._circuitState.isOpen = false;
  }

  /**
   * Chat completion using OpenAI SDK
   *
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @param {object} options - { model, temperature, maxTokens, timeout }
   * @returns {Promise<{content: string, model: string, usage: object}>}
   */
  async chat(messages, options = {}) {
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    if (this._isCircuitOpen()) {
      logger.warn({ operation: 'chat', requestId }, 'Request blocked by circuit breaker');
      throw new Error('AI service temporarily unavailable (circuit breaker open)');
    }

    const model = options.model || this.defaultModel;

    logger.debug(
      { operation: 'chat', requestId },
      'Starting chat request',
      { model, messageCount: messages?.length }
    );

    try {
      const response = await this._openai.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || options.max_tokens,
        stream: false,
      });

      const duration = Date.now() - startTime;
      this._recordSuccess();

      const result = {
        content: response.choices[0]?.message?.content || '',
        model: response.model || model,
        provider: 'openai-compat',
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
      };

      logger.info(
        { operation: 'chat', requestId },
        'Chat completed',
        { duration, model: result.model, responseLength: result.content?.length }
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this._recordFailure();

      logger.error(
        { operation: 'chat', requestId },
        'Chat failed',
        { duration, model, error: error.message }
      );

      throw error;
    }
  }

  /**
   * Simple text generation
   *
   * @param {string} prompt - The prompt text
   * @param {object} options - { model, temperature, systemPrompt, maxTokens }
   * @returns {Promise<string>} Generated text
   */
  async generate(prompt, options = {}) {
    const messages = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const result = await this.chat(messages, {
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    return result.content;
  }

  /**
   * Vision analysis with image
   *
   * @param {string} imageData - Base64 encoded image or URL
   * @param {string} prompt - Analysis prompt
   * @param {object} options - { mimeType, model }
   * @returns {Promise<string>} Analysis result
   */
  async vision(imageData, prompt, options = {}) {
    const model = options.model || AI_MODELS.VISION;
    const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');

    let imageContent;
    if (isUrl) {
      imageContent = { type: 'image_url', image_url: { url: imageData } };
    } else {
      const mimeType = options.mimeType || 'image/jpeg';
      imageContent = {
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${imageData}` }
      };
    }

    const messages = [
      {
        role: 'user',
        content: [
          imageContent,
          { type: 'text', text: prompt }
        ]
      }
    ];

    const result = await this.chat(messages, { model });
    return result.content;
  }

  /**
   * Streaming chat completion
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options
   * @yields {string} Text chunks
   */
  async *streamChat(messages, options = {}) {
    const model = options.model || this.defaultModel;

    try {
      const stream = await this._openai.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }

      this._recordSuccess();
    } catch (error) {
      this._recordFailure();
      throw error;
    }
  }

  /**
   * Streaming text generation
   *
   * @param {string} prompt
   * @param {object} options
   * @yields {string} Text chunks
   */
  async *stream(prompt, options = {}) {
    const messages = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    yield* this.streamChat(messages, options);
  }

  /**
   * Create embeddings
   *
   * @param {string|string[]} input - Text to embed
   * @param {object} options - { model }
   * @returns {Promise<{embeddings: number[][], model: string, usage: object}>}
   */
  async embeddings(input, options = {}) {
    const model = options.model || AI_MODELS.EMBEDDING;

    try {
      const response = await this._openai.embeddings.create({
        model,
        input: Array.isArray(input) ? input : [input],
      });

      this._recordSuccess();

      return {
        embeddings: response.data.map(d => d.embedding),
        model: response.model,
        usage: response.usage,
      };
    } catch (error) {
      this._recordFailure();
      throw error;
    }
  }

  /**
   * List available models
   *
   * @returns {Promise<Array>}
   */
  async listModels() {
    try {
      const response = await this._openai.models.list();
      this._recordSuccess();
      return response.data;
    } catch (error) {
      this._recordFailure();
      logger.warn({ operation: 'listModels' }, 'Failed to list models', { error: error.message });
      return [];
    }
  }

  /**
   * Health check
   *
   * @param {boolean} force - Force fresh check
   * @returns {Promise<{ok: boolean, status: object}>}
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
      // Try to list models as a health check
      const models = await this._openai.models.list();
      const isHealthy = Array.isArray(models.data);

      this._healthCache.isHealthy = isHealthy;
      this._healthCache.lastCheck = now;
      this._healthCache.status = { modelCount: models.data?.length || 0 };

      return { ok: isHealthy, status: this._healthCache.status };
    } catch (error) {
      this._healthCache.isHealthy = false;
      this._healthCache.lastCheck = now;

      logger.warn({ operation: 'health' }, 'Health check failed', { error: error.message });

      return { ok: false, error: error.message };
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
    };
  }

  /**
   * Get provider info
   */
  getProviderInfo() {
    return {
      provider: 'openai-compat',
      baseUrl: this.baseUrl,
      defaultModel: this.defaultModel,
    };
  }
}

// ============================================================================
// Singleton & Helper Functions
// ============================================================================

let _client = null;
const _embeddingClients = new Map();

/**
 * Get the default OpenAI compatible client instance
 */
export function getOpenAIClient(options = {}) {
  if (!_client || Object.keys(options).length > 0) {
    _client = new OpenAICompatClient(options);
  }
  return _client;
}

/**
 * Get a cached OpenAI-compatible client for embeddings.
 */
export function getOpenAIEmbeddingClient(options = {}) {
  const baseUrl = options.baseUrl || getEmbeddingBaseUrl();
  const apiKey = options.apiKey || OPENAI_API_KEY;
  const cacheKey = `${baseUrl}::${apiKey}`;

  if (!_embeddingClients.has(cacheKey)) {
    _embeddingClients.set(cacheKey, new OpenAICompatClient({ baseUrl, apiKey }));
  }

  return _embeddingClients.get(cacheKey);
}

/**
 * Helper: Chat completion
 */
export async function openaiChat(messages, options = {}) {
  const client = getOpenAIClient();
  return client.chat(messages, options);
}

/**
 * Helper: Text generation
 */
export async function openaiGenerate(prompt, options = {}) {
  const client = getOpenAIClient();
  return client.generate(prompt, options);
}

/**
 * Helper: Vision analysis
 */
export async function openaiVision(imageData, prompt, options = {}) {
  const client = getOpenAIClient();
  return client.vision(imageData, prompt, options);
}

/**
 * Helper: Streaming chat
 */
export async function* openaiStreamChat(messages, options = {}) {
  const client = getOpenAIClient();
  yield* client.streamChat(messages, options);
}

/**
 * Helper: Embeddings
 */
export async function openaiEmbeddings(input, options = {}) {
  const { baseUrl, apiKey, model, ...embedOptions } = options;
  const client = getOpenAIEmbeddingClient({ baseUrl, apiKey });
  const embeddingModel = model || getEmbeddingModel();
  return client.embeddings(input, { model: embeddingModel, ...embedOptions });
}
export default OpenAICompatClient;
