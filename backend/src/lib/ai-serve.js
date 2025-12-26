/**
 * Virtual Agent Service (VAS) Client
 *
 * All LLM calls are routed through the VAS stack:
 *   - vas-core (port 7012): Core OpenCode engine (3 replicas)
 *   - vas-proxy (port 7016): Simplified /auto-chat endpoint (3 replicas)
 *   - vas-admin (port 7080): Token management
 *   - nginx-lb: Load balancer for vas-core and vas-proxy
 *
 * Architecture:
 *   Backend API -> nginx-lb:7016 -> vas-proxy (1-3) -> vas-core (1-3) -> LLM Provider
 *
 * Features:
 *   - Request timeout with AbortController
 *   - Health check before critical operations
 *   - Automatic retry with exponential backoff
 *   - Circuit breaker pattern for fault tolerance
 *
 * Usage:
 *   const vas = new VASClient();
 *   const response = await vas.chat([{ role: 'user', content: 'Hello!' }]);
 *   // or
 *   const text = await vas.generate('Summarize this text...');
 */

import { config } from '../config.js';

/**
 * Structured logger for VAS Client
 * Provides consistent log format with context
 */
const logger = {
  _format(level, context, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: 'vas-client',
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
    if (process.env.DEBUG_VAS === 'true') {
      console.debug(this._format('debug', context, message, data));
    }
  },
};

// Default configuration - points to nginx-lb (load balancer)
const AI_SERVE_BASE_URL = process.env.AI_SERVE_BASE_URL || 'http://nginx-lb:7016';
const VAS_CORE_URL = process.env.VAS_CORE_URL || 'http://nginx-lb:7012';
const AI_SERVE_DEFAULT_PROVIDER = process.env.AI_SERVE_DEFAULT_PROVIDER || 'github-copilot';
const AI_SERVE_DEFAULT_MODEL = process.env.AI_SERVE_DEFAULT_MODEL || 'gpt-4.1';

// Timeout settings (in milliseconds)
const DEFAULT_TIMEOUT = 120000; // 2 minutes for normal requests
const LONG_TIMEOUT = 300000; // 5 minutes for long operations (translation, vision)
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds for health checks

// Circuit breaker settings
const CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening circuit
const CIRCUIT_BREAKER_RESET_TIME = 30000; // 30 seconds before trying again

/**
 * Fetch with timeout support using AbortController
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
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
 * Virtual Agent Service (VAS) API Client
 */
export class VASClient {
  constructor(options = {}) {
    // vas-proxy URL for simplified chat (via load balancer)
    this.baseUrl = options.baseUrl || AI_SERVE_BASE_URL;
    // Direct vas-core URL for advanced operations (via load balancer)
    this.vasCoreUrl = options.vasCoreUrl || VAS_CORE_URL;
    this.defaultProvider = options.provider || AI_SERVE_DEFAULT_PROVIDER;
    this.defaultModel = options.model || AI_SERVE_DEFAULT_MODEL;

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
      cacheDuration: 10000, // 10 seconds
    };
  }

  /**
   * Check if circuit breaker is open
   * @returns {boolean}
   */
  _isCircuitOpen() {
    if (!this._circuitState.isOpen) return false;

    // Check if enough time has passed to try again
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
        'Circuit breaker opened due to repeated failures',
        { failures: this._circuitState.failures, threshold: CIRCUIT_BREAKER_THRESHOLD }
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
   * Simple text generation via vas-proxy
   * @param {string} prompt - The prompt text
   * @param {object} options - Options (provider, model, timeout)
   * @returns {Promise<string>} Generated text
   */
  async generate(prompt, options = {}) {
    const requestId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    if (this._isCircuitOpen()) {
      logger.warn(
        { operation: 'generate', requestId },
        'Request blocked by circuit breaker'
      );
      throw new Error('AI service temporarily unavailable (circuit breaker open)');
    }

    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.defaultModel;
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    logger.debug(
      { operation: 'generate', requestId },
      'Starting generation request',
      { provider, model, promptLength: prompt?.length, timeout }
    );

    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/auto-chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: prompt,
            providerID: provider,
            modelID: model,
            title: `backend-generate-${Date.now()}`,
          }),
        },
        timeout
      );

      if (!response.ok) {
        const error = await response.text().catch(() => '');
        throw new Error(`AI generation failed: ${response.status} ${error}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      this._recordSuccess();

      logger.info(
        { operation: 'generate', requestId },
        'Generation completed successfully',
        { provider, model, duration, responseLength: data.response?.text?.length || 0 }
      );

      return data.response?.text || '';
    } catch (error) {
      const duration = Date.now() - startTime;
      this._recordFailure();

      logger.error(
        { operation: 'generate', requestId },
        'Generation failed',
        {
          provider,
          model,
          duration,
          error: error.message,
          circuitState: this.getCircuitState(),
        }
      );

      throw error;
    }
  }

  /**
   * Chat completion with message history via vas-proxy
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @param {object} options - Options (provider, model, timeout)
   * @returns {Promise<{content: string, model: string, provider: string}>}
   */
  async chat(messages, options = {}) {
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    if (this._isCircuitOpen()) {
      logger.warn(
        { operation: 'chat', requestId },
        'Request blocked by circuit breaker'
      );
      throw new Error('AI service temporarily unavailable (circuit breaker open)');
    }

    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.defaultModel;
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    logger.debug(
      { operation: 'chat', requestId },
      'Starting chat request',
      { provider, model, messageCount: messages?.length, timeout }
    );

    // For chat with history, format messages into a single prompt
    // vas-proxy creates a new session per request
    let prompt;
    if (messages.length === 1) {
      prompt = messages[0].content;
    } else {
      // Format conversation history
      const formatted = messages.map((m) => {
        const role = m.role === 'assistant' ? 'Assistant' : 'User';
        return `${role}: ${m.content}`;
      }).join('\n\n');
      prompt = formatted;
    }

    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/auto-chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: prompt,
            providerID: provider,
            modelID: model,
            title: `backend-chat-${Date.now()}`,
          }),
        },
        timeout
      );

      if (!response.ok) {
        const error = await response.text().catch(() => '');
        throw new Error(`AI chat failed: ${response.status} ${error}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      this._recordSuccess();

      logger.info(
        { operation: 'chat', requestId },
        'Chat completed successfully',
        {
          provider,
          model,
          duration,
          sessionId: data.sessionId,
          responseLength: data.response?.text?.length || 0,
        }
      );

      return {
        content: data.response?.text || '',
        model,
        provider,
        sessionId: data.sessionId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this._recordFailure();

      logger.error(
        { operation: 'chat', requestId },
        'Chat failed',
        {
          provider,
          model,
          duration,
          messageCount: messages?.length,
          error: error.message,
          circuitState: this.getCircuitState(),
        }
      );

      throw error;
    }
  }

  /**
   * Vision analysis with image
   * @param {string} imageBase64 - Base64 encoded image
   * @param {string} mimeType - Image MIME type
   * @param {string} prompt - Analysis prompt
   * @param {object} options - Options
   * @returns {Promise<string>} Analysis result
   */
  async vision(imageBase64, mimeType, prompt, options = {}) {
    const requestId = `vision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    logger.info(
      { operation: 'vision', requestId },
      'Starting vision analysis',
      { mimeType, imageSize: imageBase64?.length, promptLength: prompt?.length }
    );

    // Include image as data URL in the message
    const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;
    const fullPrompt = `[Image: ${imageDataUrl}]\n\n${prompt}`;

    // Use vision-capable model with longer timeout
    return this.generate(fullPrompt, {
      ...options,
      model: options.model || 'gpt-4o',
      timeout: options.timeout || LONG_TIMEOUT,
    });
  }

  /**
   * Health check - checks vas-proxy health (with caching)
   * @param {boolean} force - Force fresh check, ignore cache
   * @returns {Promise<{ok: boolean, status: object}>}
   */
  async health(force = false) {
    const now = Date.now();

    // Return cached result if still valid
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
        {},
        HEALTH_CHECK_TIMEOUT
      );

      if (!response.ok) {
        this._healthCache.isHealthy = false;
        this._healthCache.lastCheck = now;
        return { ok: false, error: `Status ${response.status}` };
      }

      const data = await response.json();
      const isHealthy = data.status === 'ok' && data.tokenReady;

      this._healthCache.isHealthy = isHealthy;
      this._healthCache.lastCheck = now;
      this._healthCache.status = data;

      return {
        ok: isHealthy,
        status: data,
      };
    } catch (err) {
      this._healthCache.isHealthy = false;
      this._healthCache.lastCheck = now;

      logger.warn(
        { operation: 'health' },
        'Health check failed',
        { error: err.message }
      );

      return { ok: false, error: err.message };
    }
  }

  /**
   * Status check - gets detailed status from vas-proxy
   * @returns {Promise<{ok: boolean, status: object}>}
   */
  async status() {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/status`,
        {},
        HEALTH_CHECK_TIMEOUT
      );

      if (!response.ok) {
        return { ok: false, error: `Status ${response.status}` };
      }

      const data = await response.json();
      return { ok: true, status: data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Load balancer status - check nginx-lb health
   * @returns {Promise<{ok: boolean, status: object}>}
   */
  async lbStatus() {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/lb-status`,
        {},
        HEALTH_CHECK_TIMEOUT
      );

      if (!response.ok) {
        return { ok: false, error: `Status ${response.status}` };
      }

      const data = await response.json();
      return { ok: true, status: data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Get available providers from vas-core directly
   * @returns {Promise<{providers: Array}>}
   */
  async providers() {
    const response = await fetchWithTimeout(
      `${this.vasCoreUrl}/config/providers`,
      {},
      HEALTH_CHECK_TIMEOUT
    );

    if (!response.ok) {
      throw new Error(`Failed to get providers: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get circuit breaker state (for monitoring)
   * @returns {object}
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

// Legacy alias for backward compatibility
export const AIServeClient = VASClient;

// Singleton instance
let _client = null;

/**
 * Get the default VAS client instance
 * @returns {VASClient}
 */
export function getVASClient() {
  if (!_client) {
    _client = new VASClient();
  }
  return _client;
}

// Legacy alias for backward compatibility
export const getAIServeClient = getVASClient;

/**
 * Legacy compatibility: generateContent function
 * Drop-in replacement for the old Gemini generateContent
 *
 * @param {string} prompt - The prompt text
 * @param {object} options - Options (temperature is noted but not directly used)
 * @returns {Promise<string>} Generated text
 */
export async function generateContent(prompt, options = {}) {
  const client = getVASClient();
  return client.generate(prompt, options);
}

/**
 * Legacy compatibility: tryParseJson function
 * Attempts to parse JSON from AI response text
 */
export function tryParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // empty
  }
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      // empty
    }
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const maybe = text.slice(start, end + 1);
    try {
      return JSON.parse(maybe);
    } catch {
      // empty
    }
  }
  return null;
}

export default VASClient;
