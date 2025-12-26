/**
 * LiteLLM Client - Unified AI Gateway
 *
 * OpenAI-compatible client that routes through LiteLLM proxy.
 * LiteLLM handles all provider switching, fallbacks, and load balancing.
 *
 * Architecture:
 *   Backend API -> LiteLLM (port 4000) -> Any LLM Provider
 *
 * Benefits:
 *   - Single endpoint, single API format (OpenAI-compatible)
 *   - No more provider-specific if/else branches
 *   - Automatic fallback: gpt-4 → gemini → claude
 *   - Load balancing and rate limiting built-in
 *   - Cost tracking and budget management
 *
 * Usage:
 *   const client = getLiteLLMClient();
 *   const response = await client.chat([{ role: 'user', content: 'Hello!' }]);
 *   // or with streaming
 *   for await (const chunk of client.stream([{ role: 'user', content: 'Hello!' }])) {
 *     process.stdout.write(chunk);
 *   }
 */

/**
 * Structured logger for LiteLLM Client
 */
const logger = {
  _format(level, context, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: 'litellm-client',
      ...context,
      message,
      ...data,
    };
    return JSON.stringify(logEntry);
  },

  info(context, message, data) {
    console.log(this._format('info', context, message, data));
  },

  warn(context, message, data) {
    console.warn(this._format('warn', context, message, data));
  },

  error(context, message, data) {
    console.error(this._format('error', context, message, data));
  },

  debug(context, message, data) {
    if (process.env.DEBUG_LITELLM === 'true') {
      console.debug(this._format('debug', context, message, data));
    }
  },
};

// Configuration from environment
const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || 'http://litellm:4000';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || 'sk-litellm-master-key';
const DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'gpt-4.1';

// Timeout settings
const DEFAULT_TIMEOUT = 120000; // 2 minutes
const LONG_TIMEOUT = 300000; // 5 minutes for vision/translation
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

// Circuit breaker settings
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIME = 30000;

/**
 * Fetch with timeout using AbortController
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
      throw new Error(`Request timeout after ${timeout}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * LiteLLM API Client (OpenAI-compatible)
 */
export class LiteLLMClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || LITELLM_BASE_URL;
    this.apiKey = options.apiKey || LITELLM_API_KEY;
    this.defaultModel = options.model || DEFAULT_MODEL;

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
    };
  }

  /**
   * Get default headers for API requests
   */
  _getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
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

  _recordSuccess() {
    this._circuitState.failures = 0;
    this._circuitState.isOpen = false;
  }

  /**
   * Chat completion - OpenAI-compatible format
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options - { model, temperature, max_tokens, ... }
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
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    logger.debug(
      { operation: 'chat', requestId },
      'Starting chat request',
      { model, messageCount: messages?.length }
    );

    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens,
            ...options,
          }),
        },
        timeout
      );

      if (!response.ok) {
        const error = await response.text().catch(() => '');
        throw new Error(`LiteLLM chat failed: ${response.status} ${error}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      this._recordSuccess();

      logger.info(
        { operation: 'chat', requestId },
        'Chat completed',
        {
          model: data.model,
          duration,
          usage: data.usage,
        }
      );

      return {
        content: data.choices?.[0]?.message?.content || '',
        model: data.model,
        usage: data.usage,
        finishReason: data.choices?.[0]?.finish_reason,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this._recordFailure();

      logger.error(
        { operation: 'chat', requestId },
        'Chat failed',
        { model, duration, error: error.message }
      );

      throw error;
    }
  }

  /**
   * Simple text generation (convenience wrapper)
   * @param {string} prompt
   * @param {object} options
   * @returns {Promise<string>}
   */
  async generate(prompt, options = {}) {
    const messages = [{ role: 'user', content: prompt }];

    if (options.systemPrompt) {
      messages.unshift({ role: 'system', content: options.systemPrompt });
    }

    const response = await this.chat(messages, options);
    return response.content;
  }

  /**
   * Streaming chat completion
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options
   * @yields {string} Content chunks
   */
  async *stream(messages, options = {}) {
    const requestId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (this._isCircuitOpen()) {
      throw new Error('AI service temporarily unavailable (circuit breaker open)');
    }

    const model = options.model || this.defaultModel;

    logger.debug({ operation: 'stream', requestId }, 'Starting stream', { model });

    const response = await fetchWithTimeout(
      `${this.baseUrl}/v1/chat/completions`,
      {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens,
          ...options,
        }),
      },
      options.timeout || DEFAULT_TIMEOUT
    );

    if (!response.ok) {
      const error = await response.text().catch(() => '');
      this._recordFailure();
      throw new Error(`LiteLLM stream failed: ${response.status} ${error}`);
    }

    this._recordSuccess();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Vision analysis with image
   * @param {string} imageUrl - URL or base64 data URL
   * @param {string} prompt
   * @param {object} options
   * @returns {Promise<string>}
   */
  async vision(imageUrl, prompt, options = {}) {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
        ],
      },
    ];

    // Use vision-capable model
    const response = await this.chat(messages, {
      model: options.model || 'gpt-4o',
      timeout: options.timeout || LONG_TIMEOUT,
      ...options,
    });

    return response.content;
  }

  /**
   * Embeddings generation
   * @param {string|string[]} input
   * @param {object} options
   * @returns {Promise<number[][]>}
   */
  async embeddings(input, options = {}) {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/v1/embeddings`,
      {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({
          model: options.model || 'text-embedding-ada-002',
          input: Array.isArray(input) ? input : [input],
        }),
      },
      options.timeout || DEFAULT_TIMEOUT
    );

    if (!response.ok) {
      throw new Error(`LiteLLM embeddings failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data.map((d) => d.embedding);
  }

  /**
   * Health check
   * @param {boolean} force
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
      const response = await fetchWithTimeout(
        `${this.baseUrl}/health`,
        { headers: this._getHeaders() },
        HEALTH_CHECK_TIMEOUT
      );

      const isHealthy = response.ok;
      const status = response.ok ? await response.json().catch(() => ({})) : {};

      this._healthCache.isHealthy = isHealthy;
      this._healthCache.lastCheck = now;
      this._healthCache.status = status;

      return { ok: isHealthy, status };
    } catch (err) {
      this._healthCache.isHealthy = false;
      this._healthCache.lastCheck = now;

      logger.warn({ operation: 'health' }, 'Health check failed', { error: err.message });
      return { ok: false, error: err.message };
    }
  }

  /**
   * List available models
   * @returns {Promise<Array>}
   */
  async models() {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/v1/models`,
      { headers: this._getHeaders() },
      HEALTH_CHECK_TIMEOUT
    );

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
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

// Singleton instance
let _client = null;

/**
 * Get the default LiteLLM client instance
 */
export function getLiteLLMClient() {
  if (!_client) {
    _client = new LiteLLMClient();
  }
  return _client;
}

/**
 * Legacy compatibility: generateContent (drop-in replacement)
 */
export async function generateContent(prompt, options = {}) {
  const client = getLiteLLMClient();
  return client.generate(prompt, options);
}

/**
 * Legacy compatibility: tryParseJson
 */
export function tryParseJson(text) {
  if (!text) return null;

  // Try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  // Try code fence
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      // continue
    }
  }

  // Try substring
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      // continue
    }
  }

  return null;
}

export default LiteLLMClient;
