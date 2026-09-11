import { normalizeTaskDataForMode } from './llm';
import { parseStructuredResponse } from '@blog/shared/runtime/structured-response';
/**
 * Unified AI Service for Cloudflare Workers
 *
 * 모든 AI 호출은 자체 백엔드 서버(api.nodove.com)를 통해 처리됩니다.
 * 이 모듈은 백엔드의 ai-service.js와 동일한 인터페이스를 제공합니다.
 *
 * Architecture:
 *   Workers Route -> AIService -> Backend API -> Provider (selected by backend)
 *
 * Features:
 *   - Provider-agnostic interface (backend handles provider selection)
 *   - KV-based dynamic configuration
 *   - Automatic fallback data on failure
 *   - Structured task support (sketch, prism, chain, summary)
 */

import type { Env } from '../types';
import { getAiServeUrl, getAiServeApiKey, getAiDefaultModel, getAiVisionModel } from './config';
import { attachOriginSignatureHeadersForUrl } from './origin-signature';
import { buildTaskPrompt, getFallbackData, type TaskMode, type TaskPayload } from './prompts';

export const TRACE_ID_HEADER = 'X-Trace-ID';

// ============================================================================
// Types
// ============================================================================

export type GenerateOptions = {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  systemPrompt?: string;
  idempotencyKey?: string;
  timeout?: number;
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatOptions = {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  timeout?: number;
};

export type ChatResult = {
  content: string;
  model: string;
  provider: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type VisionOptions = {
  mimeType?: string;
  model?: string;
  timeout?: number;
};

export type TaskOptions = {
  temperature?: number;
};

export type TaskResult<T = unknown> = {
  ok: boolean;
  data: T;
  error?: string;
};

// ============================================================================
// AIService Class
// ============================================================================

export class AIService {
  private env: Env;
  private baseUrl: string | null = null;
  private traceId: string | null = null;

  constructor(env: Env, traceId?: string) {
    this.env = env;
    this.traceId = traceId || null;
  }

  setTraceId(traceId: string): void {
    this.traceId = traceId;
  }

  /**
   * Get the backend API URL (cached)
   *
   * Uses BACKEND_ORIGIN directly to avoid calling api.nodove.com (Workers itself).
   * This ensures AI requests go to the actual backend server.
   */
  private async getBaseUrl(): Promise<string> {
    if (!this.baseUrl) {
      // Priority: BACKEND_ORIGIN > AI_SERVER_URL (from KV/env)
      // BACKEND_ORIGIN points to the actual backend server (blog-b.nodove.com)
      // AI_SERVER_URL defaults to api.nodove.com which is Workers itself!
      this.baseUrl = this.env.BACKEND_ORIGIN || (await getAiServeUrl(this.env));
    }
    return this.baseUrl;
  }

  /**
   * Build request headers with authentication
   */
  private async buildHeaders(): Promise<Headers> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'User-Agent': 'Blog-Workers/1.0',
      Accept: 'application/json',
    });

    if (this.traceId) {
      headers.set(TRACE_ID_HEADER, this.traceId);
    }

    const [apiKey, forcedModel, forcedVisionModel] = await Promise.all([
      getAiServeApiKey(this.env),
      getAiDefaultModel(this.env),
      getAiVisionModel(this.env),
    ]);
    if (apiKey) {
      headers.set('X-API-KEY', apiKey);
    }
    if (forcedModel) {
      headers.set('X-AI-Model', forcedModel);
    }
    if (forcedVisionModel) {
      headers.set('X-AI-Vision-Model', forcedVisionModel);
    }

    if (this.env.BACKEND_KEY) {
      headers.set('X-Backend-Key', this.env.BACKEND_KEY);
    }

    return headers;
  }

  /**
   * Make a request to the backend API
   */
  private async request<T>(
    endpoint: string,
    body: unknown,
    options: { timeout?: number; idempotencyKey?: string } = {}
  ): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/ai${endpoint}`;
    const headers = await this.buildHeaders();
    if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
    await attachOriginSignatureHeadersForUrl({
      env: this.env,
      headers,
      method: 'POST',
      url,
    });

    const controller = new AbortController();
    const timeoutId = options.timeout
      ? setTimeout(() => controller.abort(), options.timeout)
      : undefined;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        throw Object.assign(new Error(`Backend AI error: ${res.status}`), {
          status: res.status,
          code: 'AI_ERROR',
        });
      }

      const payload = (await res.json()) as { ok?: boolean; data?: T; error?: string };

      if (payload.ok === false) {
        throw new Error(payload.error || 'Backend returned error');
      }

      return (payload.data ?? payload) as T;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Generate text from a prompt
   */
  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const result = await this.request<{ text: string }>(
      '/generate',
      {
        prompt,
        temperature: options.temperature ?? 0.2,
        maxTokens: options.maxTokens,
        model: options.model,
        systemPrompt: options.systemPrompt,
        timeout: options.timeout,
      },
      { timeout: options.timeout, idempotencyKey: options.idempotencyKey }
    );

    return result.text;
  }

  /**
   * Chat completion with message history
   */
  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    return this.request<ChatResult>(
      '/auto-chat',
      {
        messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        model: options.model,
      },
      { timeout: options.timeout }
    );
  }

  /**
   * Vision analysis with image
   */
  async vision(imageData: string, prompt: string, options: VisionOptions = {}): Promise<string> {
    const result = await this.request<{ description: string }>(
      '/vision/analyze',
      {
        imageBase64: imageData,
        mimeType: options.mimeType || 'image/jpeg',
        prompt,
        model: options.model,
      },
      { timeout: options.timeout }
    );

    return result.description;
  }

  /**
   * Execute a structured AI task (sketch, prism, chain, summary)
   */
  async task<T = unknown>(
    mode: TaskMode,
    payload: TaskPayload,
    options: TaskOptions = {}
  ): Promise<TaskResult<T>> {
    const config = buildTaskPrompt(mode, payload);
    const fullPrompt = `${config.system}\n\n${config.user}`;

    try {
      const text = await this.generate(fullPrompt, {
        temperature: options.temperature ?? config.temperature,
        maxTokens: config.maxTokens,
      });

      const json = normalizeTaskDataForMode(mode, tryParseJson(text), payload) as T | null;
      if (json && typeof json === 'object') {
        return { ok: true, data: json };
      }

      console.error(`[AIService:${mode}] Invalid JSON response from backend AI`);
      return {
        ok: false,
        data: {
          ...(getFallbackData(mode, payload) as Record<string, unknown>),
          _fallback: true,
        } as T,
        error: 'AI task response was not valid JSON',
      };
    } catch (err) {
      console.error(`[AIService:${mode}] Error:`, err instanceof Error ? err.message : err);
      return {
        ok: false,
        data: {
          ...(getFallbackData(mode, payload) as Record<string, unknown>),
          _fallback: true,
        } as T,
        error: err instanceof Error ? err.message : 'AI task failed',
      };
    }
  }

  /**
   * Summarize content
   */
  async summarize(
    content: string,
    options: { instructions?: string; temperature?: number } = {}
  ): Promise<{ summary: string; keyPoints?: string[] }> {
    const result = await this.task<{ summary: string; keyPoints?: string[] }>(
      'summary',
      { content, prompt: options.instructions },
      { temperature: options.temperature }
    );
    return result.data;
  }

  /**
   * Health check
   *
   * Checks backend AI health directly so auth/provider failures are surfaced.
   */
  async health(): Promise<{ ok: boolean; provider?: string; status?: string }> {
    try {
      const backendOrigin = this.env.BACKEND_ORIGIN;

      if (!backendOrigin) {
        return {
          ok: false,
          status: 'BACKEND_ORIGIN not configured',
          provider: 'unknown',
        };
      }

      const url = `${backendOrigin.replace(/\/$/, '')}/api/v1/ai/health`;

      const headers = new Headers({
        Accept: 'application/json',
        'User-Agent': 'Blog-Workers/1.0',
      });

      if (this.env.BACKEND_KEY) {
        headers.set('X-Backend-Key', this.env.BACKEND_KEY);
      }
      await attachOriginSignatureHeadersForUrl({
        env: this.env,
        headers,
        method: 'GET',
        url,
      });

      const res = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        return { ok: false, status: `HTTP ${res.status}`, provider: 'backend' };
      }

      const data = (await res.json()) as {
        ok?: boolean;
        data?: {
          status?: string;
          provider?: string;
          health?: {
            error?: string;
            status?: unknown;
          };
        };
      };

      const aiStatus = data.data?.status || 'unknown';
      const provider = data.data?.provider || 'backend';
      const errorMessage = data.data?.health?.error;

      return {
        ok: aiStatus === 'healthy',
        provider,
        status: errorMessage || aiStatus,
      };
    } catch (err) {
      return {
        ok: false,
        status: err instanceof Error ? err.message : 'unknown error',
        provider: 'unknown',
      };
    }
  }

  /**
   * Get provider info
   *
   * Returns static provider info since dynamic fetching from backend
   * may cause issues when opencode-backend is unavailable.
   */
  async getProviderInfo(): Promise<{
    provider: string;
    features: Record<string, boolean>;
  }> {
    const visionModel = await getAiVisionModel(this.env);

    // Return static info - the actual provider is determined by backend config
    // We don't need to call backend /ai/status which may fail
    return {
      provider: 'backend-proxy',
      features: {
        chat: true,
        generate: true,
        vision: Boolean(visionModel),
        summarize: true,
        stream: true,
        sketch: true,
        prism: true,
        chain: true,
      },
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * JSON 파싱 유틸리티
 * LLM 응답에서 JSON을 추출합니다.
 */
export function tryParseJson<T = unknown>(text: string): T | null {
  return parseStructuredResponse(text) as T | null;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAIService(env: Env, traceId?: string): AIService {
  return new AIService(env, traceId);
}

// ============================================================================
// Legacy Exports (for backward compatibility with gemini.ts)
// ============================================================================

export type { GenerateOptions as GenerateContentOptions };

/**
 * Legacy generateContent function
 * @deprecated Use createAIService(env).generate() instead
 */
export async function generateContent(
  prompt: string,
  env: Env,
  options?: GenerateOptions
): Promise<string> {
  const service = createAIService(env);
  return service.generate(prompt, options);
}
