/**
 * Unified AI Service
 *
 * All AI requests are routed through an OpenAI SDK compatible server.
 * This provides a consistent interface regardless of the underlying LLM provider.
 *
 * Architecture:
 *   Blog API → OpenAI-compatible server → LLM Provider
 *
 * Configuration is managed via OPENAI_API_BASE_URL or AI_SERVER_URL.
 *
 * Usage:
 *   import { aiService } from './ai.service.js';
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

import { logAIUsage } from '../../repositories/ai-usage.repository.js';
import { enqueueAITask, waitForAIResult } from './task-queue.service.js';
import { config } from '../../config.js';
import {
  AI_MODELS,
  AI_API,
  AI_TEMPERATURES,
  TEXT_LIMITS,
  TIMEOUTS,
  FALLBACK_DATA,
} from '../../config/constants.js';

let getOpenAIClient, OpenAICompatClient;
try {
  ({ getOpenAIClient, default: OpenAICompatClient } = await import('./openai-client.service.js'));
} catch (err) {
  console.error('[AIService] Failed to import openai-client.service:', err.message);
  getOpenAIClient = null;
  OpenAICompatClient = null;
}

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

export class AIService {
  constructor() {
    this._openaiClient = null;
    this._useAsyncQueue = process.env.AI_ASYNC_MODE === 'true';
    this._redisChecked = false;
    this._redisAvailable = false;
    
    if (!getOpenAIClient) {
      throw new Error('OpenAI client not available. Check openai-client.service.js import.');
    }
    
    logger.info(
      { operation: 'init' },
      `AIService initialized (async: ${this._useAsyncQueue})`
    );
  }

  async _checkRedisAvailable() {
    if (this._redisChecked) {
      return this._redisAvailable;
    }
    
    try {
      const { isRedisAvailable } = await import('../../lib/redis-client.js');
      this._redisAvailable = await isRedisAvailable();
    } catch {
      this._redisAvailable = false;
    }
    
    this._redisChecked = true;
    logger.debug(
      { operation: 'redis-check' },
      `Redis availability: ${this._redisAvailable}`
    );
    return this._redisAvailable;
  }

  async _shouldUseAsyncQueue(options = {}) {
    if (options.sync === true) {
      return false;
    }
    
    if (!this._useAsyncQueue) {
      return false;
    }
    
    return this._checkRedisAvailable();
  }

  _getOpenAIClient() {
    if (this._openaiClient) return this._openaiClient;
    this._openaiClient = getOpenAIClient();
    return this._openaiClient;
  }

  _getClient() {
    return this._getOpenAIClient();
  }

  async generate(prompt, options = {}) {
    const requestId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    logger.debug(
      { operation: 'generate', requestId },
      'Starting generation',
      { promptLength: prompt?.length }
    );

    const useAsync = await this._shouldUseAsyncQueue(options);
    
    if (useAsync) {
      return this._generateAsync(prompt, options, requestId, startTime);
    }

    return this._generateSync(prompt, options, requestId, startTime);
  }

  async _generateSync(prompt, options, requestId, startTime) {
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

      logAIUsage({
        modelName: options.model || this._getDefaultModel(),
        requestType: 'completion',
        promptTokens: this._estimateTokens(prompt),
        completionTokens: this._estimateTokens(result),
        latencyMs: duration,
        status: 'success',
        metadata: { requestId },
      }).catch(() => {});

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        { operation: 'generate', requestId },
        'Generation failed',
        { duration, error: error.message }
      );

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

  async _generateAsync(prompt, options, requestId, startTime) {
    logger.info(
      { operation: 'generate', requestId, mode: 'async' },
      'Enqueueing async generation'
    );

    const taskId = await enqueueAITask({
      type: 'generate',
      payload: { prompt, options },
      priority: options.priority || 'normal',
    });

    const result = await waitForAIResult(taskId, options.timeout || TIMEOUTS.DEFAULT);
    
    if (!result.ok) {
      throw new Error(result.error || 'Async generation failed');
    }

    const duration = Date.now() - startTime;
    logger.info(
      { operation: 'generate', requestId, mode: 'async' },
      'Async generation completed',
      { duration, resultLength: result.data?.length }
    );

    logAIUsage({
      modelName: options.model || this._getDefaultModel(),
      requestType: 'completion',
      promptTokens: this._estimateTokens(prompt),
      completionTokens: this._estimateTokens(result.data),
      latencyMs: duration,
      status: 'success',
      metadata: { requestId, async: true },
    }).catch(() => {});

    return result.data;
  }

  async chat(messages, options = {}) {
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    logger.debug(
      { operation: 'chat', requestId },
      'Starting chat',
      { messageCount: messages?.length }
    );

    const useAsync = await this._shouldUseAsyncQueue(options);
    
    if (useAsync) {
      return this._chatAsync(messages, options, requestId, startTime);
    }

    return this._chatSync(messages, options, requestId, startTime);
  }

  async _chatSync(messages, options, requestId, startTime) {
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
        provider: response.provider || 'openai-compat',
        usage: response.usage,
        sessionId: response.sessionId,
      };

      if (!result.content || result.content.trim() === '') {
        throw new Error('AI returned empty response');
      }

      const duration = Date.now() - startTime;
      logger.info(
        { operation: 'chat', requestId },
        'Chat completed',
        { duration, resultLength: result.content?.length }
      );

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

  async _chatAsync(messages, options, requestId, startTime) {
    logger.info(
      { operation: 'chat', requestId, mode: 'async' },
      'Enqueueing async chat'
    );

    const taskId = await enqueueAITask({
      type: 'chat',
      payload: { messages, options },
      priority: options.priority || 'normal',
    });

    const result = await waitForAIResult(taskId, options.timeout || TIMEOUTS.DEFAULT);
    
    if (!result.ok) {
      throw new Error(result.error || 'Async chat failed');
    }

    const duration = Date.now() - startTime;
    logger.info(
      { operation: 'chat', requestId, mode: 'async' },
      'Async chat completed',
      { duration, resultLength: result.data?.content?.length }
    );

    logAIUsage({
      modelName: result.data?.model || options.model || this._getDefaultModel(),
      requestType: 'chat',
      promptTokens: this._estimateTokens(JSON.stringify(messages)),
      completionTokens: this._estimateTokens(result.data?.content),
      latencyMs: duration,
      status: 'success',
      metadata: { requestId, async: true },
    }).catch(() => {});

    return result.data;
  }

  async vision(imageData, prompt, options = {}) {
    const requestId = `vision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    
    const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');

    logger.info(
      { operation: 'vision', requestId },
      'Starting vision analysis',
      { type: isUrl ? 'url' : 'base64', model: options.model || AI_MODELS.VISION }
    );

    try {
      const client = this._getClient();
      const result = await client.vision(imageData, prompt, {
        mimeType: options.mimeType || 'image/jpeg',
        model: options.model || AI_MODELS.VISION,
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

  async *stream(prompt, options = {}) {
    const client = this._getClient();
    yield* client.stream(prompt, options);
  }

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

  _buildTaskPrompt(mode, payload) {
    const { paragraph, postTitle, persona, content, prompt: userPrompt } = payload;
    const truncated = this._safeTruncate(paragraph || content || '', TEXT_LIMITS.TASK_PARAGRAPH);
    const titleTrunc = this._safeTruncate(postTitle || '', TEXT_LIMITS.TASK_TITLE);

    switch (mode) {
      case 'sketch':
        return {
          system: 'You are a helpful writing companion. Return STRICT JSON only.',
          user: [
            '{"mood":"string","bullets":["string", "string", "..."]}',
            '',
            `Persona: ${persona || FALLBACK_DATA.PERSONA}`,
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
          mood: FALLBACK_DATA.MOOD,
          bullets: sentences.slice(0, 4).map(s =>
            s.length > TEXT_LIMITS.BULLET_TEXT ? `${s.slice(0, TEXT_LIMITS.BULLET_TEXT - 2)}…` : s
          ),
        };
      }

      case 'prism':
        return {
          facets: [
            { title: FALLBACK_DATA.FACETS[0]?.title || '핵심 요점', points: [this._safeTruncate(paragraph, TEXT_LIMITS.BULLET_TEXT)] },
            { title: FALLBACK_DATA.FACETS[1]?.title || '생각해볼 점', points: FALLBACK_DATA.FACETS[1]?.points || ['관점 A', '관점 B'] },
          ],
        };

      case 'chain':
        return {
          questions: FALLBACK_DATA.QUESTIONS,
        };

      case 'summary':
        return { summary: this._safeTruncate(paragraph, FALLBACK_DATA.SUMMARY_LENGTH) };

      default:
        return { text: paragraph };
    }
  }

  _getTaskTemperature(mode) {
    const temps = {
      sketch: AI_TEMPERATURES.SKETCH,
      prism: AI_TEMPERATURES.PRISM,
      chain: AI_TEMPERATURES.CHAIN,
      summary: AI_TEMPERATURES.SUMMARY,
    };
    return temps[mode] ?? AI_TEMPERATURES.SUMMARY;
  }

  _safeTruncate(s, n) {
    if (!s) return s;
    return s.length > n ? `${s.slice(0, n)}\n…(truncated)` : s;
  }

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

  _estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  _getDefaultModel() {
    return config.ai?.defaultModel
      || process.env.AI_DEFAULT_MODEL
      || process.env.OPENAI_DEFAULT_MODEL
      || AI_MODELS.DEFAULT;
  }

  async health(force = false) {
    try {
      const client = this._getClient();
      return client.health?.(force) || { ok: false, error: 'Health check not available' };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  getProviderInfo() {
    const baseUrl = config.ai?.baseUrl
      || process.env.OPENAI_API_BASE_URL
      || process.env.AI_SERVER_URL
      || AI_API.BASE_URL
      || 'https://api.openai.com/v1';

    return {
      provider: 'openai-compat',
      config: {
        baseUrl,
        defaultModel: config.ai?.defaultModel || process.env.AI_DEFAULT_MODEL || AI_MODELS.DEFAULT,
      },
    };
  }
}

let _service = null;

export function getAIService() {
  if (!_service) {
    _service = new AIService();
  }
  return _service;
}

export const aiService = getAIService();

export function tryParseJson(text) {
  return aiService.tryParseJson(text);
}

export default AIService;
