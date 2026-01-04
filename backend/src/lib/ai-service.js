/**
 * Unified AI Service
 *
 * All AI requests are routed through ai-server-backend → ai-server-serve.
 * This provides a consistent interface regardless of the underlying LLM provider.
 *
 * Architecture:
 *   Blog API → ai-server-backend:7016 → ai-server-serve:7012 → LLM Provider
 *
 * The ai-server-serve handles provider selection (GitHub Copilot, OpenAI, Anthropic, etc.)
 * Configuration is managed through ai-server-serve, not this service.
 *
 * Usage:
 *   import { aiService } from './lib/ai-service.js';
 *
 *   // Simple generation
 *   const text = await aiService.generate('Summarize this text...');
 *
 *   // Chat with messages
 *   const response = await aiService.chat([
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hello!' }
 *   ]);
 *
 *   // Structured task (sketch, prism, chain)
 *   const result = await aiService.task('sketch', { paragraph: '...' });
 */

import { logAIUsage } from './ai-usage-logger.js';

// OpenCode client for ai-server-backend communication
let getOpenCodeClient, opencodeTryParse;
try {
  ({ getOpenCodeClient, tryParseJson: opencodeTryParse } = await import('./opencode-client.js'));
} catch (err) {
  console.error('[AIService] Failed to import opencode-client:', err.message);
  getOpenCodeClient = null;
  opencodeTryParse = null;
}

// ============================================================================
// Logger
// ============================================================================

const logger = {
  _format(level, context, message, data = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'ai-service',
      ...context,
      message,
      ...data,
    });
  },
  info(ctx, msg, data) { console.log(this._format('info', ctx, msg, data)); },
  warn(ctx, msg, data) { console.warn(this._format('warn', ctx, msg, data)); },
  error(ctx, msg, data) { console.error(this._format('error', ctx, msg, data)); },
  debug(ctx, msg, data) {
    if (process.env.DEBUG_AI === 'true') {
      console.debug(this._format('debug', ctx, msg, data));
    }
  },
};

// ============================================================================
// Unified AI Service Class
// ============================================================================

export class AIService {
  constructor() {
    this._client = null;
    
    logger.info(
      { operation: 'init' },
      'AIService initialized (opencode-only mode)'
    );
  }

  /**
   * Get the OpenCode client
   */
  _getClient() {
    if (this._client) return this._client;
    
    if (!getOpenCodeClient) {
      throw new Error('OpenCode client not available. Check opencode-client.js import.');
    }
    
    this._client = getOpenCodeClient();
    return this._client;
  }

  /**
   * Generate text from a prompt
   *
   * @param {string} prompt - The prompt text
   * @param {object} options - { temperature, model, systemPrompt, timeout }
   * @returns {Promise<string>} Generated text
   */
  async generate(prompt, options = {}) {
    const requestId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    logger.debug(
      { operation: 'generate', requestId },
      'Starting generation',
      { promptLength: prompt?.length }
    );

    try {
      const client = this._getClient();
      const result = await client.generate(prompt, {
        temperature: options.temperature,
        model: options.model,
        systemPrompt: options.systemPrompt,
        timeout: options.timeout,
      });

      const duration = Date.now() - startTime;
      logger.info(
        { operation: 'generate', requestId },
        'Generation completed',
        { duration, resultLength: result?.length }
      );

      // Log usage asynchronously (fire and forget)
      logAIUsage({
        modelName: options.model || this._getDefaultModel(),
        requestType: 'completion',
        promptTokens: this._estimateTokens(prompt),
        completionTokens: this._estimateTokens(result),
        latencyMs: duration,
        status: 'success',
        metadata: { requestId },
      }).catch(() => {}); // Silently ignore logging errors

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        { operation: 'generate', requestId },
        'Generation failed',
        { duration, error: error.message }
      );

      // Log failed request
      logAIUsage({
        modelName: options.model || this._getDefaultModel(),
        requestType: 'completion',
        promptTokens: this._estimateTokens(prompt),
        latencyMs: duration,
        status: 'error',
        errorMessage: error.message,
        metadata: { requestId },
      }).catch(() => {});

      throw error;
    }
  }

  /**
   * Chat completion with message history
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options - { temperature, model, timeout }
   * @returns {Promise<{content: string, model: string, provider: string}>}
   */
  async chat(messages, options = {}) {
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    logger.debug(
      { operation: 'chat', requestId },
      'Starting chat',
      { messageCount: messages?.length }
    );

    try {
      const client = this._getClient();
      const response = await client.chat(messages, {
        temperature: options.temperature,
        model: options.model,
        timeout: options.timeout,
      });

      const result = {
        content: response.content,
        model: response.model,
        provider: 'opencode',
        usage: response.usage,
        sessionId: response.sessionId,
      };

      // Validate response - throw error if empty
      if (!result.content || result.content.trim() === '') {
        throw new Error('AI returned empty response');
      }

      const duration = Date.now() - startTime;
      logger.info(
        { operation: 'chat', requestId },
        'Chat completed',
        { duration, resultLength: result.content?.length }
      );

      // Log usage asynchronously with actual token counts if available
      logAIUsage({
        modelName: result.model || options.model || this._getDefaultModel(),
        requestType: 'chat',
        promptTokens: result.usage?.prompt_tokens || this._estimateTokens(JSON.stringify(messages)),
        completionTokens: result.usage?.completion_tokens || this._estimateTokens(result.content),
        latencyMs: duration,
        status: 'success',
        metadata: { requestId },
      }).catch(() => {});

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        { operation: 'chat', requestId },
        'Chat failed',
        { duration, error: error.message }
      );

      // Log failed request
      logAIUsage({
        modelName: options.model || this._getDefaultModel(),
        requestType: 'chat',
        promptTokens: this._estimateTokens(JSON.stringify(messages)),
        latencyMs: duration,
        status: 'error',
        errorMessage: error.message,
        metadata: { requestId },
      }).catch(() => {});

      throw error;
    }
  }

  /**
   * Vision analysis with image
   * 
   * @param {string} imageData - R2 URL (https://...) or Base64 encoded image
   * @param {string} prompt - Analysis prompt
   * @param {object} options - { mimeType, model, timeout }
   * @returns {Promise<string>} Analysis result
   */
  async vision(imageData, prompt, options = {}) {
    const requestId = `vision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    
    const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');

    logger.info(
      { operation: 'vision', requestId },
      'Starting vision analysis',
      { type: isUrl ? 'url' : 'base64', model: options.model || 'gpt-4o' }
    );

    try {
      const client = this._getClient();
      const result = await client.vision(imageData, prompt, {
        mimeType: options.mimeType || 'image/jpeg',
        model: options.model || 'gpt-4o',
        timeout: options.timeout,
      });

      const duration = Date.now() - startTime;
      logger.info(
        { operation: 'vision', requestId },
        'Vision analysis completed',
        { duration, resultLength: result?.length }
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        { operation: 'vision', requestId },
        'Vision analysis failed',
        { duration, error: error.message }
      );
      throw error;
    }
  }

  /**
   * Streaming generation
   *
   * @param {string} prompt - The prompt text
   * @param {object} options
   * @yields {string} Text chunks
   */
  async *stream(prompt, options = {}) {
    const client = this._getClient();
    yield* client.stream(prompt, options);
  }

  /**
   * Execute a structured AI task (sketch, prism, chain, summary)
   *
   * @param {string} mode - Task mode
   * @param {object} payload - Task-specific payload
   * @param {object} options - { temperature }
   * @returns {Promise<object>} Parsed result
   */
  async task(mode, payload, options = {}) {
    const prompts = this._buildTaskPrompt(mode, payload);
    const temperature = options.temperature ?? this._getTaskTemperature(mode);

    try {
      const text = await this.generate(prompts.user, {
        systemPrompt: prompts.system,
        temperature,
      });

      const json = this.tryParseJson(text);
      if (json && typeof json === 'object') {
        return { ok: true, data: json };
      }

      // Fallback data
      return { ok: true, data: this._getFallbackData(mode, payload) };
    } catch (error) {
      logger.warn(
        { operation: 'task', mode },
        'Task generation failed, using fallback',
        { error: error.message }
      );
      return { ok: true, data: this._getFallbackData(mode, payload) };
    }
  }

  /**
   * Build prompt for structured task
   */
  _buildTaskPrompt(mode, payload) {
    const { paragraph, postTitle, persona, content, prompt: userPrompt } = payload;
    const truncated = this._safeTruncate(paragraph || content || '', 1600);
    const titleTrunc = this._safeTruncate(postTitle || '', 120);

    switch (mode) {
      case 'sketch':
        return {
          system: 'You are a helpful writing companion. Return STRICT JSON only.',
          user: [
            '{"mood":"string","bullets":["string", "string", "..."]}',
            '',
            `Persona: ${persona || 'default'}`,
            `Post: ${titleTrunc}`,
            'Paragraph:',
            truncated,
            '',
            'Task: Capture the emotional sketch. Select a concise mood (e.g., curious, excited, skeptical) and 3-6 short bullets in the original language.',
          ].join('\n'),
        };

      case 'prism':
        return {
          system: 'Return STRICT JSON only for idea facets.',
          user: [
            '{"facets":[{"title":"string","points":["string","string"]}]}',
            `Post: ${titleTrunc}`,
            'Paragraph:',
            truncated,
            '',
            'Task: Provide 2-3 facets (titles) with 2-4 concise points each, in the original language.',
          ].join('\n'),
        };

      case 'chain':
        return {
          system: 'Return STRICT JSON only for follow-up questions.',
          user: [
            '{"questions":[{"q":"string","why":"string"}]}',
            `Post: ${titleTrunc}`,
            'Paragraph:',
            truncated,
            '',
            'Task: Generate 3-5 short follow-up questions and a brief why for each, in the original language.',
          ].join('\n'),
        };

      case 'summary':
        return {
          system: userPrompt || 'You are a helpful assistant that summarizes text concisely.',
          user: `Summarize the following content in Korean, concise but faithful to key points.\n\n${truncated}`,
        };

      default:
        return {
          system: 'You are a helpful assistant.',
          user: truncated,
        };
    }
  }

  /**
   * Get fallback data for task mode
   */
  _getFallbackData(mode, payload) {
    const paragraph = payload.paragraph || payload.content || '';

    switch (mode) {
      case 'sketch': {
        const sentences = paragraph
          .replace(/\n+/g, ' ')
          .split(/[.!?]\s+/)
          .map(s => s.trim())
          .filter(Boolean);
        return {
          mood: 'curious',
          bullets: sentences.slice(0, 4).map(s =>
            s.length > 140 ? `${s.slice(0, 138)}…` : s
          ),
        };
      }

      case 'prism':
        return {
          facets: [
            { title: '핵심 요점', points: [this._safeTruncate(paragraph, 140)] },
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
        return { summary: this._safeTruncate(paragraph, 200) };

      default:
        return { text: paragraph };
    }
  }

  /**
   * Get temperature for task mode
   */
  _getTaskTemperature(mode) {
    const temps = {
      sketch: 0.3,
      prism: 0.2,
      chain: 0.2,
      summary: 0.2,
    };
    return temps[mode] ?? 0.2;
  }

  /**
   * Safely truncate string
   */
  _safeTruncate(s, n) {
    if (!s) return s;
    return s.length > n ? `${s.slice(0, n)}\n…(truncated)` : s;
  }

  /**
   * Try to parse JSON from AI response
   */
  tryParseJson(text) {
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

  /**
   * Estimate token count from text (rough approximation: ~4 chars per token)
   */
  _estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Get default model name
   */
  _getDefaultModel() {
    return process.env.OPENCODE_DEFAULT_MODEL || process.env.AI_DEFAULT_MODEL || 'gpt-4.1';
  }

  /**
   * Health check
   */
  async health(force = false) {
    try {
      const client = this._getClient();
      return client.health?.(force) || { ok: false, error: 'Health check not available' };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get current provider info
   */
  getProviderInfo() {
    return {
      provider: 'opencode',
      config: {
        baseUrl: process.env.OPENCODE_BASE_URL || 'http://ai-server-backend:7016',
        defaultProvider: process.env.OPENCODE_DEFAULT_PROVIDER || 'github-copilot',
        defaultModel: process.env.OPENCODE_DEFAULT_MODEL || 'gpt-4.1',
      },
    };
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

let _service = null;

/**
 * Get the singleton AIService instance
 */
export function getAIService() {
  if (!_service) {
    _service = new AIService();
  }
  return _service;
}

// Default singleton instance
export const aiService = getAIService();

// Export tryParseJson for backward compatibility
export function tryParseJson(text) {
  return aiService.tryParseJson(text);
}

export default AIService;
