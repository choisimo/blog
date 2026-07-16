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

import OpenAI from "openai";
import { config } from "../../config.js";
import { isPlaceholderConfigValue } from "../../../../shared/src/contracts/config-registry.js";
import {
  AI_MODELS,
  TIMEOUTS,
  CIRCUIT_BREAKER,
  OPENAI_CLIENT,
} from "../../config/constants.js";
import { createLogger } from "../../lib/logger.js";
import {
  getCachedAIConfigSnapshot,
  primeAIConfigRefresh,
} from "./dynamic-config.service.js";

// Timeout settings
const DEFAULT_TIMEOUT = TIMEOUTS.DEFAULT; // 2 minutes

// Circuit breaker settings
const CIRCUIT_BREAKER_THRESHOLD = CIRCUIT_BREAKER.THRESHOLD;
const CIRCUIT_BREAKER_RESET_TIME = CIRCUIT_BREAKER.RESET_TIME; // 30 seconds

// The protected Spark route currently exposes Chat Completions as an SSE
// stream. Aggregate that stream for callers using the synchronous chat API.
const STREAM_AGGREGATION_MODELS = new Set(["gpt-5.3-codex-spark"]);

function normalizeModelList(value) {
  let candidates = value;

  if (typeof candidates === "string") {
    try {
      candidates = JSON.parse(candidates);
    } catch {
      candidates = candidates.split(",");
    }
  }

  if (!Array.isArray(candidates)) {
    return [];
  }

  return [...new Set(
    candidates
      .map((model) => String(model || "").trim())
      .filter(Boolean),
  )];
}

// ============================================================================
// Logger
// ============================================================================

const logger = createLogger('openai-compat-client');

// ============================================================================
// OpenAI Compatible Client Class
// ============================================================================

export class OpenAICompatClient {
  constructor(options = {}) {
    let baseURL =
      options.baseUrl ||
      config.ai?.baseUrl ||
      process.env.OPENAI_API_BASE_URL ||
      process.env.AI_SERVER_URL ||
      "https://api.openai.com/v1";
    if (!baseURL.endsWith("/v1")) {
      baseURL = baseURL.replace(/\/$/, "") + "/v1";
    }

    this.baseUrl = baseURL;
    const resolvedApiKey =
      options.apiKey ||
      config.ai?.apiKey ||
      process.env.AI_API_KEY ||
      process.env.OPENAI_API_KEY;
    if (config.security?.protectedEnvironment && isPlaceholderConfigValue(resolvedApiKey)) {
      throw new Error(
        "AI API key is required and cannot be a placeholder in protected environments"
      );
    }
    this.apiKey = resolvedApiKey || "sk-placeholder";
    this.defaultModel =
      options.model ||
      config.ai?.defaultModel ||
      process.env.AI_DEFAULT_MODEL ||
      AI_MODELS.DEFAULT;
    this.fallbackModels = normalizeModelList(
      options.fallbackModels ?? AI_MODELS.FALLBACKS,
    );

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

    logger.info({ operation: "init" }, "OpenAICompatClient initialized", {
      baseUrl: this.baseUrl,
      defaultModel: this.defaultModel,
      fallbackModels: this.fallbackModels,
    });
  }

  /**
   * Get the underlying OpenAI client
   */
  get openai() {
    return this._openai;
  }

  _containsImageContent(messages) {
    return (messages || []).some((message) => {
      if (!Array.isArray(message?.content)) {
        return false;
      }

      return message.content.some(
        (part) => part?.type === "image_url" || part?.image_url,
      );
    });
  }

  _getModelCandidates(primaryModel, messages, options = {}) {
    const allowFallback =
      options.allowFallback !== false && !this._containsImageContent(messages);
    const fallbackModels = allowFallback
      ? normalizeModelList(options.fallbackModels ?? this.fallbackModels)
      : [];

    return [...new Set([primaryModel, ...fallbackModels].filter(Boolean))];
  }

  async _chatCompletionForModel(messages, options, model, isFallback) {
    if (STREAM_AGGREGATION_MODELS.has(model)) {
      const stream = await this._openai.chat.completions.create(
        {
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens || options.max_tokens,
          stream: true,
        },
        {
          timeout: options.timeout || DEFAULT_TIMEOUT,
        },
      );

      let content = "";
      let responseModel = model;
      let finishReason;
      let usage;

      for await (const chunk of stream) {
        responseModel = chunk.model || responseModel;
        finishReason =
          chunk.choices?.[0]?.finish_reason ?? finishReason;
        usage = chunk.usage ?? usage;
        content += chunk.choices?.[0]?.delta?.content || "";
      }

      return {
        content,
        model: responseModel,
        provider: isFallback
          ? "openai-compat-fallback"
          : "openai-compat-stream-aggregate",
        usage,
        finishReason,
      };
    }

    const response = await this._openai.chat.completions.create(
      {
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || options.max_tokens,
        stream: false,
      },
      {
        timeout: options.timeout || DEFAULT_TIMEOUT,
      },
    );

    return {
      content: response.choices[0]?.message?.content || "",
      model: response.model || model,
      provider: isFallback
        ? "openai-compat-fallback"
        : "openai-compat",
      usage: response.usage,
      finishReason: response.choices[0]?.finish_reason,
    };
  }

  _shouldTryLegacyCompletions(error) {
    if (process.env.AI_ENABLE_LEGACY_COMPLETIONS_FALLBACK === "false") {
      return false;
    }

    const status = error?.status || error?.code;
    const message = error?.message || "";
    return (
      status === 401 ||
      status === 404 ||
      status === 405 ||
      /Authentication is required|not found|method not allowed/i.test(message)
    );
  }

  _messageContentToText(content) {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      if (content.some((part) => part?.type === "image_url" || part?.image_url)) {
        throw new Error("Legacy completions fallback does not support image content");
      }

      return content
        .map((part) => {
          if (typeof part === "string") return part;
          if (typeof part?.text === "string") return part.text;
          if (typeof part?.content === "string") return part.content;
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }

    if (typeof content?.text === "string") {
      return content.text;
    }

    if (typeof content?.content === "string") {
      return content.content;
    }

    return "";
  }

  _messagesToLegacyPrompt(messages) {
    const lines = [];

    for (const message of messages || []) {
      const text = this._messageContentToText(message.content).trim();
      if (!text) continue;

      const role = String(message.role || "user").toLowerCase();
      const label =
        role === "system"
          ? "System"
          : role === "assistant"
            ? "Assistant"
            : role === "tool"
              ? "Tool"
              : "User";

      lines.push(`${label}: ${text}`);
    }

    lines.push("Assistant:");
    const prompt = lines.join("\n\n").trim();
    if (!prompt || prompt === "Assistant:") {
      throw new Error("Legacy completions fallback requires text messages");
    }

    return prompt;
  }

  async _chatViaLegacyCompletions(messages, options, originalModel, requestId, startTime) {
    const model =
      options.legacyCompletionsModel ||
      process.env.AI_LEGACY_COMPLETIONS_MODEL ||
      originalModel;
    const prompt = this._messagesToLegacyPrompt(messages);

    logger.warn(
      { operation: "chat", requestId },
      "Retrying chat request via legacy completions endpoint",
      { originalModel, model },
    );

    const response = await this._openai.completions.create(
      {
        model,
        prompt,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || options.max_tokens || 1024,
        stream: false,
      },
      {
        timeout: options.timeout || DEFAULT_TIMEOUT,
      },
    );

    const duration = Date.now() - startTime;
    this._recordSuccess();

    const result = {
      content: response.choices[0]?.text || "",
      model: response.model || model,
      provider: "openai-compat-legacy-completions",
      usage: response.usage,
      finishReason: response.choices[0]?.finish_reason,
    };

    logger.info({ operation: "chat", requestId }, "Legacy completions completed", {
      duration,
      model: result.model,
      responseLength: result.content?.length,
    });

    return result;
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
      logger.warn({ operation: "circuit_breaker" }, "Circuit breaker opened", {
        failures: this._circuitState.failures,
      });
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
      logger.warn(
        { operation: "chat", requestId },
        "Request blocked by circuit breaker",
      );
      throw new Error(
        "AI service temporarily unavailable (circuit breaker open)",
      );
    }

    const primaryModel = options.model || this.defaultModel;
    const modelCandidates = this._getModelCandidates(
      primaryModel,
      messages,
      options,
    );

    logger.debug({ operation: "chat", requestId }, "Starting chat request", {
      model: primaryModel,
      fallbackModels: modelCandidates.slice(1),
      messageCount: messages?.length,
    });

    let lastError;

    for (const [index, model] of modelCandidates.entries()) {
      const isFallback = index > 0;

      if (isFallback) {
        logger.warn(
          { operation: "chat", requestId },
          "Retrying chat with fallback model",
          {
            primaryModel,
            fallbackModel: model,
            previousError: lastError?.message,
          },
        );
      }

      try {
        const result = await this._chatCompletionForModel(
          messages,
          options,
          model,
          isFallback,
        );
        const duration = Date.now() - startTime;
        this._recordSuccess();

        logger.info({ operation: "chat", requestId }, "Chat completed", {
          duration,
          model: result.model,
          fallbackUsed: isFallback,
          responseLength: result.content?.length,
        });

        return result;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError && this._shouldTryLegacyCompletions(lastError)) {
      try {
        return await this._chatViaLegacyCompletions(
          messages,
          options,
          primaryModel,
          requestId,
          startTime,
        );
      } catch (fallbackError) {
        logger.warn(
          { operation: "chat", requestId },
          "Legacy completions fallback failed",
          { model: primaryModel, error: fallbackError.message },
        );
      }
    }

    const duration = Date.now() - startTime;
    this._recordFailure();

    logger.error({ operation: "chat", requestId }, "Chat failed", {
      duration,
      model: primaryModel,
      attemptedModels: modelCandidates,
      error: lastError?.message || "No AI model candidates configured",
    });

    throw lastError || new Error("No AI model candidates configured");
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
      messages.push({ role: "system", content: options.systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

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
    const requestId = `vision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const model = options.model || AI_MODELS.VISION;
    const isUrl =
      imageData.startsWith("http://") || imageData.startsWith("https://");

    if (!model) {
      throw new Error("Vision model is not configured");
    }

    if (this._isCircuitOpen()) {
      logger.warn(
        { operation: "vision", requestId },
        "Request blocked by circuit breaker"
      );
      throw new Error(
        "AI service temporarily unavailable (circuit breaker open)"
      );
    }

    let imageContent;
    if (isUrl) {
      imageContent = { type: "image_url", image_url: { url: imageData } };
    } else {
      const mimeType = options.mimeType || "image/jpeg";
      imageContent = {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${imageData}` },
      };
    }

    const messages = [
      {
        role: "user",
        content: [imageContent, { type: "text", text: prompt }],
      },
    ];

    try {
      const result = await this.chat(messages, { model });
      return result.content;
    } catch (error) {
      logger.error({ operation: "vision", requestId }, "Vision analysis failed", {
        model,
        error: error.message,
      });
      throw error;
    }
  }
  /**
   * Streaming chat completion
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options
   * @yields {string} Text chunks
   */
  async *streamChat(messages, options = {}) {
    const requestId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const primaryModel = options.model || this.defaultModel;
    const modelCandidates = this._getModelCandidates(
      primaryModel,
      messages,
      options,
    );

    if (this._isCircuitOpen()) {
      logger.warn(
        { operation: "streamChat", requestId },
        "Stream request blocked by circuit breaker"
      );
      throw new Error(
        "AI service temporarily unavailable (circuit breaker open)"
      );
    }

    logger.debug({ operation: "streamChat", requestId }, "Starting stream request", {
      model: primaryModel,
      fallbackModels: modelCandidates.slice(1),
      messageCount: messages?.length,
    });

    let lastError;

    for (const [index, model] of modelCandidates.entries()) {
      const isFallback = index > 0;
      let emittedContent = false;

      if (isFallback) {
        logger.warn(
          { operation: "streamChat", requestId },
          "Retrying stream with fallback model",
          {
            primaryModel,
            fallbackModel: model,
            previousError: lastError?.message,
          },
        );
      }

      try {
        const stream = await this._openai.chat.completions.create(
          {
            model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens,
            stream: true,
          },
          {
            timeout: options.timeout || DEFAULT_TIMEOUT,
          },
        );

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            emittedContent = true;
            yield content;
          }
        }

        this._recordSuccess();
        return;
      } catch (error) {
        lastError = error;

        // Once content reached the caller, restarting with another model would
        // duplicate or contradict the partial response.
        if (emittedContent) {
          this._recordFailure();
          logger.error(
            { operation: "streamChat", requestId },
            "Stream failed after emitting content",
            { model, error: error.message },
          );
          throw error;
        }
      }
    }

    this._recordFailure();
    logger.error({ operation: "streamChat", requestId }, "Stream failed", {
      model: primaryModel,
      attemptedModels: modelCandidates,
      error: lastError?.message || "No AI model candidates configured",
    });
    throw lastError || new Error("No AI model candidates configured");
  }

  /**
   * Streaming text generation
   *
   * @param {string} prompt
   * @param {object} options
   * @yields {string} Text chunks
   */
  async *stream(prompt, options = {}) {
    const requestId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (this._isCircuitOpen()) {
      logger.warn(
        { operation: "stream", requestId },
        "Stream request blocked by circuit breaker"
      );
      throw new Error(
        "AI service temporarily unavailable (circuit breaker open)"
      );
    }

    const messages = [];

    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

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
        embeddings: response.data.map((d) => d.embedding),
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
      logger.warn({ operation: "listModels" }, "Failed to list models", {
        error: error.message,
      });
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

    if (
      !force &&
      now - this._healthCache.lastCheck < this._healthCache.cacheDuration
    ) {
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

      logger.warn({ operation: "health" }, "Health check failed", {
        error: error.message,
      });

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
      provider: "openai-compat",
      baseUrl: this.baseUrl,
      defaultModel: this.defaultModel,
    };
  }
}

// ============================================================================
// Singleton & Helper Functions
// ============================================================================

let _client = null;
let _clientFingerprint = null;
const _embeddingClients = new Map();

export function getOpenAIClient(options = {}) {
  if (Object.keys(options).length > 0) {
    const snapshot = getCachedAIConfigSnapshot();
    return new OpenAICompatClient({
      baseUrl: options.baseUrl || snapshot.baseUrl,
      apiKey: options.apiKey || snapshot.apiKey || 'sk-placeholder',
      model: options.model || snapshot.defaultModel,
      ...options,
    });
  }

  const snapshot = getCachedAIConfigSnapshot();

  if (!_client || _clientFingerprint !== snapshot.fingerprint) {
    _client = new OpenAICompatClient({
      baseUrl: snapshot.baseUrl,
      apiKey: snapshot.apiKey || 'sk-placeholder',
      model: snapshot.defaultModel,
    });
    _clientFingerprint = snapshot.fingerprint;
  }

  return _client;
}

/**
 * Get a cached OpenAI-compatible client for embeddings.
 */
export function getOpenAIEmbeddingClient(options = {}) {
  const snapshot = getCachedAIConfigSnapshot();
  // Use explicit options or fall back to dynamic snapshot / rag config
  const baseUrl = options.baseUrl 
    || config.rag?.embeddingUrl 
    || snapshot.baseUrl;
  const apiKey = options.apiKey 
    || config.rag?.embeddingApiKey 
    || snapshot.apiKey 
    || 'sk-placeholder';
  const cacheKey = `${baseUrl}::${apiKey}`;

  if (!_embeddingClients.has(cacheKey)) {
    _embeddingClients.set(
      cacheKey,
      new OpenAICompatClient({ baseUrl, apiKey }),
    );
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
  const embeddingModel = model 
    || config.rag?.embeddingModel 
    || process.env.AI_EMBED_MODEL 
    || 'text-embedding-3-small';
  return client.embeddings(input, { model: embeddingModel, ...embedOptions });
}

/**
 * Get current AI client config snapshot (for status/health reporting).
 * @returns {import('./dynamic-config.service.js').AIConfigSnapshot}
 */
export function getOpenAIClientConfigSnapshot() {
  return getCachedAIConfigSnapshot();
}

export default OpenAICompatClient;

// Prime dynamic config refresh on module load
primeAIConfigRefresh();
