/**
 * OpenCode SDK Client
 *
 * Client for OpenCode backend container AI API server.
 * Uses @opencode-ai/sdk based backend server.
 *
 * Architecture (Docker):
 *   opencode (port 7012): Core OpenCode engine (opencode serve)
 *   opencode-backend (port 7016): Node.js SDK based API server
 *
 *   Blog Backend -> opencode-backend:7016 -> opencode:7012 -> LLM Provider
 *
 * API Endpoints:
 *   POST /chat        - Main chat endpoint (auto session + message + response)
 *   GET  /health      - Health check
 *   GET  /providers   - List available providers/models
 *   GET  /sessions    - List sessions
 *   POST /sessions    - Create session
 *   GET  /events      - SSE stream
 *
 * Usage:
 *   const client = new OpenCodeClient();
 *   const response = await client.chat([{ role: 'user', content: 'Hello!' }]);
 *   // or
 *   const text = await client.generate('Summarize this text...');
 */

import { config } from '../config.js';

/**
 * Structured logger for OpenCode Client
 */
const logger = {
  _format(level, context, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: 'opencode-client',
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
    if (process.env.DEBUG_OPENCODE === 'true') {
      console.debug(this._format('debug', context, message, data));
    }
  },
};

// Default configuration - points to opencode-backend container (port 7016)
const OPENCODE_BASE_URL = process.env.OPENCODE_BASE_URL || 'http://opencode-backend:7016';
const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY || '';
const OPENCODE_DEFAULT_PROVIDER = process.env.OPENCODE_DEFAULT_PROVIDER || 'github-copilot';
const OPENCODE_DEFAULT_MODEL = process.env.OPENCODE_DEFAULT_MODEL || 'gpt-4.1';

// Timeout settings (in milliseconds)
const DEFAULT_TIMEOUT = 120000; // 2 minutes for normal requests
const LONG_TIMEOUT = 300000; // 5 minutes for long operations
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds for health checks

// Circuit breaker settings
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIME = 30000; // 30 seconds

/**
 * Fetch with timeout support using AbortController
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
 * OpenCode API Client
 * Communicates with opencode-backend (Node.js SDK based server)
 */
export class OpenCodeClient {
  constructor(options = {}) {
    // opencode-backend URL (port 7016)
    this.baseUrl = options.baseUrl || OPENCODE_BASE_URL;
    this.apiKey = options.apiKey || OPENCODE_API_KEY;
    this.defaultProvider = options.provider || OPENCODE_DEFAULT_PROVIDER;
    this.defaultModel = options.model || OPENCODE_DEFAULT_MODEL;

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
      status: null,
    };

    logger.info(
      { operation: 'init' },
      'OpenCodeClient initialized',
      {
        baseUrl: this.baseUrl,
        defaultProvider: this.defaultProvider,
        defaultModel: this.defaultModel,
      }
    );
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
   * Get authorization headers
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
   * Main chat endpoint - POST /chat
   * Auto session creation + message + response
   *
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @param {object} options - Options (provider, model, sessionId, title, timeout)
   * @returns {Promise<{content: string, model: string, provider: string, sessionId: string}>}
   */
  async chat(messages, options = {}) {
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    if (this._isCircuitOpen()) {
      logger.warn({ operation: 'chat', requestId }, 'Request blocked by circuit breaker');
      throw new Error('OpenCode service temporarily unavailable (circuit breaker open)');
    }

    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.defaultModel;
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    // Format messages into a single message for /chat endpoint
    // The /chat endpoint expects { message, title?, providerID?, modelID?, sessionId? }
    let message;
    if (messages.length === 1) {
      message = messages[0].content;
    } else {
      // Format conversation history into a single prompt
      message = messages
        .map((m) => {
          const role = m.role === 'assistant' ? 'Assistant' : m.role === 'system' ? 'System' : 'User';
          return `${role}: ${m.content}`;
        })
        .join('\n\n');
    }

    logger.debug(
      { operation: 'chat', requestId },
      'Starting chat request',
      { provider, model, messageCount: messages?.length, timeout }
    );

    try {
      const requestBody = {
        message,
        providerID: provider,
        modelID: model,
        title: options.title || `backend-chat-${Date.now()}`,
      };

      // If sessionId is provided, continue the conversation
      if (options.sessionId) {
        requestBody.sessionId = options.sessionId;
      }

      const response = await fetchWithTimeout(
        `${this.baseUrl}/chat`,
        {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify(requestBody),
        },
        timeout
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`OpenCode chat failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      this._recordSuccess();

      // Response format: { sessionId, messageId, response: { text, raw } }
      const result = {
        content: data.response?.text || '',
        model,
        provider: 'opencode',
        sessionId: data.sessionId,
        messageId: data.messageId,
        raw: data.response?.raw,
      };

      logger.info(
        { operation: 'chat', requestId },
        'Chat completed successfully',
        {
          provider,
          model,
          duration,
          sessionId: result.sessionId,
          responseLength: result.content?.length || 0,
        }
      );

      return result;
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
   * Simple text generation via chat API
   *
   * @param {string} prompt - The prompt text
   * @param {object} options - Options (provider, model, systemPrompt, timeout)
   * @returns {Promise<string>} Generated text
   */
  async generate(prompt, options = {}) {
    const messages = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const result = await this.chat(messages, {
      provider: options.provider,
      model: options.model,
      timeout: options.timeout,
      title: options.title || `backend-generate-${Date.now()}`,
    });

    return result.content;
  }

  /**
   * Vision analysis with image
   * Formats the image as part of the message content
   *
   * @param {string} imageData - Base64 encoded image or URL
   * @param {string} prompt - Analysis prompt
   * @param {object} options - Options (mimeType, provider, model, timeout)
   * @returns {Promise<string>} Analysis result
   */
  async vision(imageData, prompt, options = {}) {
    const mimeType = options.mimeType || 'image/jpeg';
    const provider = options.provider || this.defaultProvider;
    const model = options.model || 'gpt-4o'; // Vision-capable model

    // Determine if imageData is URL or base64
    const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');

    // Format message with image for vision analysis
    let message;
    if (isUrl) {
      message = `[Image URL: ${imageData}]\n\n${prompt}`;
    } else {
      const imageDataUrl = `data:${mimeType};base64,${imageData}`;
      message = `[Image: ${imageDataUrl}]\n\n${prompt}`;
    }

    const result = await this.chat([{ role: 'user', content: message }], {
      provider,
      model,
      timeout: options.timeout || LONG_TIMEOUT,
      title: `vision-analysis-${Date.now()}`,
    });

    return result.content;
  }

  /**
   * Session-based prompt - POST /sessions/:id/prompt
   *
   * @param {string} sessionId - Session ID
   * @param {string} message - Message to send
   * @param {object} options - Options (provider, model, timeout)
   * @returns {Promise<{content: string, messageId: string}>}
   */
  async sendPrompt(sessionId, message, options = {}) {
    const requestId = `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    if (this._isCircuitOpen()) {
      throw new Error('OpenCode service temporarily unavailable (circuit breaker open)');
    }

    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.defaultModel;
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    logger.debug(
      { operation: 'sendPrompt', requestId },
      'Sending prompt to session',
      { sessionId, provider, model }
    );

    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/sessions/${sessionId}/prompt`,
        {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify({
            message,
            providerID: provider,
            modelID: model,
          }),
        },
        timeout
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`OpenCode prompt failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      this._recordSuccess();

      logger.info(
        { operation: 'sendPrompt', requestId },
        'Prompt completed successfully',
        { sessionId, duration, responseLength: data.response?.text?.length || 0 }
      );

      return {
        content: data.response?.text || '',
        messageId: data.messageId,
        raw: data.response?.raw,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this._recordFailure();

      logger.error(
        { operation: 'sendPrompt', requestId },
        'Prompt failed',
        { sessionId, duration, error: error.message }
      );

      throw error;
    }
  }

  /**
   * Create a new session - POST /sessions
   *
   * @param {string} title - Session title
   * @returns {Promise<{id: string, title: string}>}
   */
  async createSession(title = 'New Session') {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/sessions`,
        {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify({ title }),
        },
        HEALTH_CHECK_TIMEOUT
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to create session: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      this._recordSuccess();

      return data;
    } catch (error) {
      this._recordFailure();
      throw error;
    }
  }

  /**
   * List all sessions - GET /sessions
   *
   * @returns {Promise<Array>}
   */
  async listSessions() {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/sessions`,
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );

      if (!response.ok) {
        throw new Error(`Failed to list sessions: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      logger.warn({ operation: 'listSessions' }, 'Failed to list sessions', { error: error.message });
      return [];
    }
  }

  /**
   * Get session by ID - GET /sessions/:id
   *
   * @param {string} sessionId
   * @returns {Promise<object|null>}
   */
  async getSession(sessionId) {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/sessions/${sessionId}`,
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );

      if (!response.ok) {
        return null;
      }

      return response.json();
    } catch (error) {
      logger.warn({ operation: 'getSession' }, 'Failed to get session', { error: error.message });
      return null;
    }
  }

  /**
   * Get session messages - GET /sessions/:id/messages
   *
   * @param {string} sessionId
   * @returns {Promise<Array>}
   */
  async getSessionMessages(sessionId) {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/sessions/${sessionId}/messages`,
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );

      if (!response.ok) {
        return [];
      }

      return response.json();
    } catch (error) {
      logger.warn({ operation: 'getSessionMessages' }, 'Failed to get messages', { error: error.message });
      return [];
    }
  }

  /**
   * Delete session - DELETE /sessions/:id
   *
   * @param {string} sessionId
   * @returns {Promise<boolean>}
   */
  async deleteSession(sessionId) {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/sessions/${sessionId}`,
        {
          method: 'DELETE',
          headers: this._getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );

      return response.ok;
    } catch (error) {
      logger.warn({ operation: 'deleteSession' }, 'Failed to delete session', { error: error.message });
      return false;
    }
  }

  /**
   * Abort running session - POST /sessions/:id/abort
   *
   * @param {string} sessionId
   * @returns {Promise<boolean>}
   */
  async abortSession(sessionId) {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/sessions/${sessionId}/abort`,
        {
          method: 'POST',
          headers: this._getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );

      return response.ok;
    } catch (error) {
      logger.warn({ operation: 'abortSession' }, 'Failed to abort session', { error: error.message });
      return false;
    }
  }

  /**
   * Get available providers and models - GET /providers
   *
   * @returns {Promise<Array>}
   */
  async getProviders() {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/providers`,
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );

      if (!response.ok) {
        throw new Error(`Failed to get providers: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      logger.warn({ operation: 'getProviders' }, 'Failed to get providers', { error: error.message });
      return [];
    }
  }

  /**
   * Get available agents - GET /agents
   *
   * @returns {Promise<Array>}
   */
  async getAgents() {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/agents`,
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );

      if (!response.ok) {
        return [];
      }

      return response.json();
    } catch (error) {
      logger.warn({ operation: 'getAgents' }, 'Failed to get agents', { error: error.message });
      return [];
    }
  }

  /**
   * Get current config - GET /config
   *
   * @returns {Promise<object|null>}
   */
  async getConfig() {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/config`,
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );

      if (!response.ok) {
        return null;
      }

      return response.json();
    } catch (error) {
      logger.warn({ operation: 'getConfig' }, 'Failed to get config', { error: error.message });
      return null;
    }
  }

  /**
   * Search text in files - GET /search/text?pattern=...
   *
   * @param {string} pattern - Regex pattern
   * @returns {Promise<Array>}
   */
  async searchText(pattern) {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/search/text?pattern=${encodeURIComponent(pattern)}`,
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        DEFAULT_TIMEOUT
      );

      if (!response.ok) {
        return [];
      }

      return response.json();
    } catch (error) {
      logger.warn({ operation: 'searchText' }, 'Search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search files - GET /search/files?query=...
   *
   * @param {string} query - Search query
   * @param {object} options - { type, limit }
   * @returns {Promise<Array>}
   */
  async searchFiles(query, options = {}) {
    try {
      const params = new URLSearchParams({ query });
      if (options.type) params.append('type', options.type);
      if (options.limit) params.append('limit', options.limit.toString());

      const response = await fetchWithTimeout(
        `${this.baseUrl}/search/files?${params}`,
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        DEFAULT_TIMEOUT
      );

      if (!response.ok) {
        return [];
      }

      return response.json();
    } catch (error) {
      logger.warn({ operation: 'searchFiles' }, 'Search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Read file content - GET /file?path=...
   *
   * @param {string} filePath - File path
   * @returns {Promise<string|null>}
   */
  async readFile(filePath) {
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/file?path=${encodeURIComponent(filePath)}`,
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        DEFAULT_TIMEOUT
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.content || null;
    } catch (error) {
      logger.warn({ operation: 'readFile' }, 'Read file failed', { error: error.message });
      return null;
    }
  }

  /**
   * Streaming via SSE events - GET /events
   * Note: This returns an EventSource-compatible stream
   *
   * @param {function} onMessage - Callback for each message
   * @param {function} onError - Callback for errors
   * @returns {function} Cleanup function to close the connection
   */
  subscribeToEvents(onMessage, onError) {
    // Note: In Node.js, EventSource requires a polyfill like 'eventsource'
    // This is a simplified implementation using fetch with SSE parsing

    const controller = new AbortController();
    let closed = false;

    const connect = async () => {
      try {
        const response = await fetch(`${this.baseUrl}/events`, {
          method: 'GET',
          headers: this._getHeaders(),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data) {
                try {
                  const parsed = JSON.parse(data);
                  onMessage?.(parsed);
                } catch {
                  onMessage?.({ raw: data });
                }
              }
            }
          }
        }
      } catch (error) {
        if (!closed && error.name !== 'AbortError') {
          onError?.(error);
        }
      }
    };

    connect();

    // Return cleanup function
    return () => {
      closed = true;
      controller.abort();
    };
  }

  /**
   * Streaming text generation (simulated via /chat)
   * Note: opencode-backend doesn't have native streaming, so we use chunked response
   *
   * @param {string} prompt - The prompt text
   * @param {object} options
   * @yields {string} Text chunks
   */
  async *stream(prompt, options = {}) {
    // Since opencode-backend uses /chat which returns full response,
    // we simulate streaming by chunking the response
    const text = await this.generate(prompt, options);

    // Chunk the response for streaming-like behavior
    const chunkSize = 80;
    for (let i = 0; i < text.length; i += chunkSize) {
      yield text.slice(i, Math.min(i + chunkSize, text.length));
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  /**
   * Health check - GET /health (with caching)
   *
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
        {
          method: 'GET',
          headers: this._getHeaders(),
        },
        HEALTH_CHECK_TIMEOUT
      );

      if (!response.ok) {
        this._healthCache.isHealthy = false;
        this._healthCache.lastCheck = now;
        this._healthCache.status = { status: 'error', httpStatus: response.status };
        return { ok: false, error: `Status ${response.status}` };
      }

      const data = await response.json();
      const isHealthy = data.status === 'ok' || data.ok === true;

      this._healthCache.isHealthy = isHealthy;
      this._healthCache.lastCheck = now;
      this._healthCache.status = data;

      return {
        ok: isHealthy,
        status: data,
      };
    } catch (error) {
      this._healthCache.isHealthy = false;
      this._healthCache.lastCheck = now;

      logger.warn({ operation: 'health' }, 'Health check failed', { error: error.message });

      return { ok: false, error: error.message };
    }
  }

  /**
   * Get circuit breaker state (for monitoring)
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
   * Get provider info
   */
  getProviderInfo() {
    return {
      provider: 'opencode',
      baseUrl: this.baseUrl,
      defaultProvider: this.defaultProvider,
      defaultModel: this.defaultModel,
    };
  }
}

// Singleton instance
let _client = null;

/**
 * Get the default OpenCode client instance
 */
export function getOpenCodeClient() {
  if (!_client) {
    _client = new OpenCodeClient();
  }
  return _client;
}

/**
 * Try to parse JSON from AI response
 */
export function tryParseJson(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // Continue to other methods
  }

  // Try to extract from code fence
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      // Continue
    }
  }

  // Try to extract raw JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const maybe = text.slice(start, end + 1);
    try {
      return JSON.parse(maybe);
    } catch {
      // Give up
    }
  }

  return null;
}

export default OpenCodeClient;
