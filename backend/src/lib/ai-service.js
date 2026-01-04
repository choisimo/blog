/**
 * Unified AI Service
 *
 * Provider-agnostic AI interface that supports multiple backends:
 *   - n8n (Webhook-based workflows) - Primary, recommended for easy management
 *   - VAS (OpenCode Engine) - Direct AI server access
 *   - Gemini (Direct API) - Fallback
 *
 * Architecture:
 *   Route -> AIService -> n8n Webhook -> AI Provider (via n8n nodes)
 *
 * Configuration priority:
 *   1. AI_PROVIDER env var ('n8n', 'vas', 'gemini')
 *   2. Default: 'n8n' if N8N_WEBHOOK_URL is set, otherwise 'gemini'
 *
 * Benefits of n8n:
 *   - Visual workflow management (no code changes for AI routing)
 *   - Easy provider switching via n8n UI
 *   - Built-in retry, error handling, and logging
 *   - Centralized prompt management
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

import { config } from '../config.js';
import { getN8NClient, tryParseJson as n8nTryParse } from './n8n-client.js';
import { generateContent as geminiGenerate, tryParseJson as geminiTryParse } from './gemini.js';
import { logAIUsage } from './ai-usage-logger.js';

// Optional VAS (OpenCode) client import
let getVASClient, vasTryParse;
try {
  ({ getVASClient, tryParseJson: vasTryParse } = await import('./ai-serve.js'));
} catch { getVASClient = null; vasTryParse = null; }

// Optional OpenCode client import
let getOpenCodeClient, opencodeTryParse;
try {
  ({ getOpenCodeClient, tryParseJson: opencodeTryParse } = await import('./opencode-client.js'));
} catch { getOpenCodeClient = null; opencodeTryParse = null; }

// ============================================================================
// Configuration
// ============================================================================

/**
 * Determine the active AI provider based on environment
 * Priority: explicit AI_PROVIDER > auto-detect (opencode > n8n > vas > gemini)
 */
function getActiveProvider() {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  
  if (explicit) {
    // Map legacy providers to 'n8n' (n8n handles all routing now)
    if (explicit === 'openai') {
      console.info('[AIService] Redirecting legacy provider to n8n');
      return 'n8n';
    }
    if (['opencode', 'n8n', 'vas', 'gemini'].includes(explicit)) {
      return explicit;
    }
    console.warn(`[AIService] Unknown AI_PROVIDER "${explicit}", using default`);
  }
  
  // Auto-detect based on available configuration (opencode first)
  if (process.env.OPENCODE_BASE_URL) {
    return 'opencode';
  }
  
  if (process.env.N8N_WEBHOOK_URL || process.env.N8N_BASE_URL) {
    return 'n8n';
  }
  
  if (process.env.AI_SERVE_BASE_URL || process.env.VAS_CORE_URL) {
    return 'vas';
  }
  
  if (config.gemini?.apiKey) {
    return 'gemini';
  }
  
  return 'opencode'; // Default to opencode
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
    this.provider = getActiveProvider();
    this._client = null;
    
    logger.info(
      { operation: 'init' },
      `AIService initialized with provider: ${this.provider}`
    );
  }

  /**
   * Get or create the appropriate client
   */
  _getClient() {
    if (this._client) return this._client;
    
    switch (this.provider) {
      case 'opencode':
        this._client = getOpenCodeClient?.();
        break;
      case 'n8n':
        this._client = getN8NClient();
        break;
      case 'vas':
        this._client = getVASClient?.();
        break;
      case 'gemini':
        // Gemini uses direct function, no client object
        this._client = null;
        break;
      default:
        throw new Error(`Unknown AI provider: ${this.provider}`);
    }
    
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
      { operation: 'generate', requestId, provider: this.provider },
      'Starting generation',
      { promptLength: prompt?.length }
    );

    try {
      let result;

      switch (this.provider) {
        case 'opencode': {
          const client = this._getClient();
          result = await client.generate(prompt, {
            temperature: options.temperature,
            model: options.model,
            systemPrompt: options.systemPrompt,
            timeout: options.timeout,
          });
          break;
        }

        case 'n8n': {
          const client = this._getClient();
          result = await client.generate(prompt, {
            temperature: options.temperature,
            model: options.model,
            systemPrompt: options.systemPrompt,
            timeout: options.timeout,
          });
          break;
        }

        case 'vas': {
          const client = this._getClient();
          // VAS doesn't support system prompt directly, prepend to prompt
          const fullPrompt = options.systemPrompt
            ? `${options.systemPrompt}\n\n${prompt}`
            : prompt;
          result = await client.generate(fullPrompt, {
            model: options.model,
            timeout: options.timeout,
          });
          break;
        }

        case 'gemini': {
          const fullPrompt = options.systemPrompt
            ? `${options.systemPrompt}\n\n${prompt}`
            : prompt;
          result = await geminiGenerate(fullPrompt, {
            temperature: options.temperature ?? 0.2,
          });
          break;
        }

        default:
          throw new Error(`Unsupported provider: ${this.provider}`);
      }

      const duration = Date.now() - startTime;
      logger.info(
        { operation: 'generate', requestId, provider: this.provider },
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
        metadata: { requestId, provider: this.provider },
      }).catch(() => {}); // Silently ignore logging errors

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        { operation: 'generate', requestId, provider: this.provider },
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
        metadata: { requestId, provider: this.provider },
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
      { operation: 'chat', requestId, provider: this.provider },
      'Starting chat',
      { messageCount: messages?.length }
    );

    try {
      let result;

      switch (this.provider) {
        case 'opencode': {
          const client = this._getClient();
          try {
            const response = await client.chat(messages, {
              temperature: options.temperature,
              model: options.model,
              timeout: options.timeout,
            });
            result = {
              content: response.content,
              model: response.model,
              provider: 'opencode',
              usage: response.usage,
            };
          } catch (opencodeError) {
            // Fallback to n8n if opencode fails and n8n is configured
            if (process.env.N8N_WEBHOOK_URL || process.env.N8N_BASE_URL) {
              logger.warn(
                { operation: 'chat', requestId },
                'opencode failed, falling back to n8n',
                { error: opencodeError.message }
              );
              const n8nClient = getN8NClient();
              const fallbackResponse = await n8nClient.chat(messages, {
                temperature: options.temperature,
                model: options.model,
                timeout: options.timeout,
              });
              result = {
                content: fallbackResponse.content,
                model: fallbackResponse.model,
                provider: 'n8n-fallback',
                usage: fallbackResponse.usage,
              };
            } else if (config.gemini?.apiKey) {
              logger.warn(
                { operation: 'chat', requestId },
                'opencode failed, falling back to Gemini',
                { error: opencodeError.message }
              );
              const formattedMessages = messages.map(m => {
                if (m.role === 'system') return `System: ${m.content}`;
                if (m.role === 'assistant') return `Assistant: ${m.content}`;
                return `User: ${m.content}`;
              }).join('\n\n');
              const response = await geminiGenerate(formattedMessages, {
                temperature: options.temperature ?? 0.2,
              });
              result = {
                content: response,
                model: config.gemini?.model || 'gemini-2.0-flash',
                provider: 'gemini-fallback',
              };
            } else {
              throw opencodeError;
            }
          }
          break;
        }

        case 'n8n': {
          const client = this._getClient();
          try {
            const response = await client.chat(messages, {
              temperature: options.temperature,
              model: options.model,
              timeout: options.timeout,
            });
            result = {
              content: response.content,
              model: response.model,
              provider: 'n8n',
              usage: response.usage,
            };
          } catch (n8nError) {
            // Fallback to Gemini if n8n fails and Gemini is configured
            if (config.gemini?.apiKey) {
              logger.warn(
                { operation: 'chat', requestId },
                'n8n failed, falling back to Gemini',
                { error: n8nError.message }
              );
              const formattedMessages = messages.map(m => {
                if (m.role === 'system') return `System: ${m.content}`;
                if (m.role === 'assistant') return `Assistant: ${m.content}`;
                return `User: ${m.content}`;
              }).join('\n\n');
              const response = await geminiGenerate(formattedMessages, {
                temperature: options.temperature ?? 0.2,
              });
              result = {
                content: response,
                model: config.gemini?.model || 'gemini-2.0-flash',
                provider: 'gemini-fallback',
              };
            } else {
              throw n8nError;
            }
          }
          break;
        }

        case 'vas': {
          const client = this._getClient();
          const response = await client.chat(messages, {
            model: options.model,
            timeout: options.timeout,
          });
          result = {
            content: response.content,
            model: response.model,
            provider: 'vas',
          };
          break;
        }

        case 'gemini': {
          // Gemini: format messages into a single prompt
          const formattedMessages = messages.map(m => {
            if (m.role === 'system') return `System: ${m.content}`;
            if (m.role === 'assistant') return `Assistant: ${m.content}`;
            return `User: ${m.content}`;
          }).join('\n\n');

          const response = await geminiGenerate(formattedMessages, {
            temperature: options.temperature ?? 0.2,
          });

          result = {
            content: response,
            model: config.gemini?.model || 'gemini-2.0-flash',
            provider: 'gemini',
          };
          break;
        }

        default:
          throw new Error(`Unsupported provider: ${this.provider}`);
      }

      const duration = Date.now() - startTime;
      logger.info(
        { operation: 'chat', requestId, provider: this.provider },
        'Chat completed',
        { duration, resultLength: result?.content?.length }
      );

      // Log usage asynchronously with actual token counts if available
      logAIUsage({
        modelName: result.model || options.model || this._getDefaultModel(),
        requestType: 'chat',
        promptTokens: result.usage?.prompt_tokens || this._estimateTokens(JSON.stringify(messages)),
        completionTokens: result.usage?.completion_tokens || this._estimateTokens(result.content),
        latencyMs: duration,
        status: 'success',
        metadata: { requestId, provider: this.provider },
      }).catch(() => {});

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        { operation: 'chat', requestId, provider: this.provider },
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
        metadata: { requestId, provider: this.provider },
      }).catch(() => {});

      throw error;
    }
  }

  /**
   * Vision analysis with image
   * 
   * For R2-stored images, pass the URL directly. n8n workflow will fetch
   * the image from R2 and process it with vision-capable models.
   * 
   * Architecture:
   *   Image URL/Base64 -> n8n workflow -> Vision Model (GPT-4o, Claude, etc.)
   *                                   -> Analysis Result
   *
   * @param {string} imageData - R2 URL (https://...) or Base64 encoded image
   * @param {string} prompt - Analysis prompt
   * @param {object} options - { mimeType, model, timeout }
   * @returns {Promise<string>} Analysis result
   */
  async vision(imageData, prompt, options = {}) {
    const mimeType = options.mimeType || 'image/jpeg';
    const requestId = `vision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    
    const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');

    logger.info(
      { operation: 'vision', requestId },
      'Starting vision analysis',
      { type: isUrl ? 'url' : 'base64', model: options.model || 'gpt-4o' }
    );

    try {
      let result;

      // Vision always goes through n8n workflow for consistent R2 URL handling
      // n8n workflow can fetch images directly from R2 URLs
      switch (this.provider) {
        case 'opencode':
        case 'n8n': {
          // Both opencode and n8n providers use n8n workflow for vision
          const client = getN8NClient();
          result = await client.vision(imageData, prompt, {
            mimeType,
            model: options.model || 'gpt-4o',
            timeout: options.timeout,
          });
          break;
        }

        case 'vas': {
          const client = this._getClient();
          // VAS client expects different signature
          result = await client.vision(imageData, mimeType, prompt, {
            model: options.model,
            timeout: options.timeout,
          });
          break;
        }

        case 'gemini':
        default:
          // Fallback to n8n for vision
          const n8nClient = getN8NClient();
          result = await n8nClient.vision(imageData, prompt, {
            mimeType,
            model: options.model || 'gpt-4o',
            timeout: options.timeout,
          });
          break;
      }

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
    // opencode, n8n and VAS providers support streaming via their clients
    if (this.provider === 'opencode' || this.provider === 'n8n' || this.provider === 'vas') {
      const client = this._getClient();
      yield* client.stream(prompt, options);
      return;
    }

    // For non-streaming providers, generate full text and chunk it
    const text = await this.generate(prompt, options);
    const chunkSize = 80;
    for (let i = 0; i < text.length; i += chunkSize) {
      yield text.slice(i, Math.min(i + chunkSize, text.length));
      await new Promise(r => setTimeout(r, 25));
    }
  }

  /**
   * Embeddings generation
   *
   * @param {string|string[]} input
   * @param {object} options
   * @returns {Promise<number[][]>}
   */
  async embeddings(input, options = {}) {
    if (this.provider === 'opencode') {
      const client = this._getClient();
      return client.embeddings(input, options);
    }

    if (this.provider === 'n8n') {
      const client = this._getClient();
      return client.embeddings(input, options);
    }

    throw new Error(`Embeddings not supported for provider: ${this.provider}`);
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
    // Use provider-specific parser or generic one
    switch (this.provider) {
      case 'opencode':
        return opencodeTryParse?.(text) || this._genericTryParseJson(text);
      case 'n8n':
        return n8nTryParse(text);
      case 'vas':
        return vasTryParse?.(text) || this._genericTryParseJson(text);
      case 'gemini':
        return geminiTryParse(text);
      default:
        return this._genericTryParseJson(text);
    }
  }

  _genericTryParseJson(text) {
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
   * Get default model name based on provider
   */
  _getDefaultModel() {
    switch (this.provider) {
      case 'opencode':
        return process.env.OPENCODE_DEFAULT_MODEL || 'gpt-4.1';
      case 'n8n':
        return process.env.AI_DEFAULT_MODEL || 'gemini-2.0-flash';
      case 'vas':
        return process.env.AI_SERVE_DEFAULT_MODEL || 'gpt-4o';
      case 'gemini':
        return config.gemini?.model || 'gemini-2.0-flash';
      default:
        return 'unknown';
    }
  }

  /**
   * Health check
   */
  async health(force = false) {
    switch (this.provider) {
      case 'opencode': {
        const client = this._getClient();
        return client?.health?.(force) || { ok: false, error: 'OpenCode client not available' };
      }

      case 'n8n': {
        const client = this._getClient();
        return client.health(force);
      }

      case 'vas': {
        const client = this._getClient();
        return client?.health?.(force) || { ok: false, error: 'VAS client not available' };
      }

      case 'gemini': {
        // Gemini: simple check if API key exists
        return {
          ok: !!config.gemini?.apiKey,
          provider: 'gemini',
          status: config.gemini?.apiKey ? 'configured' : 'missing_key',
        };
      }

      default:
        return { ok: false, error: `Unknown provider: ${this.provider}` };
    }
  }

  /**
   * Get current provider info
   */
  getProviderInfo() {
    return {
      provider: this.provider,
      config: {
        opencode: {
          baseUrl: process.env.OPENCODE_BASE_URL || 'http://opencode-backend:7016',
          provider: process.env.OPENCODE_DEFAULT_PROVIDER || 'github-copilot',
          model: process.env.OPENCODE_DEFAULT_MODEL || 'gpt-4.1',
          hasKey: !!process.env.OPENCODE_API_KEY,
        },
        n8n: {
          baseUrl: process.env.N8N_WEBHOOK_URL || process.env.N8N_BASE_URL,
          model: process.env.AI_DEFAULT_MODEL || 'gemini-2.0-flash',
        },
        vas: {
          baseUrl: process.env.AI_SERVE_BASE_URL,
          model: process.env.AI_SERVE_DEFAULT_MODEL,
        },
        gemini: {
          model: config.gemini?.model,
          hasKey: !!config.gemini?.apiKey,
        },
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

/**
 * Create AIService with specific provider (for testing)
 */
export function createAIService(provider) {
  process.env.AI_PROVIDER = provider;
  _service = null;
  return getAIService();
}

// Default singleton instance
export const aiService = getAIService();

// Legacy compatibility exports - use n8n tryParseJson
export { tryParseJson } from './n8n-client.js';

export default AIService;
