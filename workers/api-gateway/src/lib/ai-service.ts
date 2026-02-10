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
import { getAiServeUrl, getAiServeApiKey } from './config';
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
      this.baseUrl = this.env.BACKEND_ORIGIN || await getAiServeUrl(this.env);
    }
    return this.baseUrl;
  }

  /**
   * Build request headers with authentication
   */
  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Blog-Workers/1.0',
      Accept: 'application/json',
    };

    if (this.traceId) {
      headers[TRACE_ID_HEADER] = this.traceId;
    }

    const apiKey = await getAiServeApiKey(this.env);
    if (apiKey) {
      headers['X-API-KEY'] = apiKey;
    }

    if (this.env.BACKEND_KEY) {
      headers['X-Backend-Key'] = this.env.BACKEND_KEY;
    }

    return headers;
  }

  /**
   * Make a request to the backend API
   */
  private async request<T>(
    endpoint: string,
    body: unknown,
    options: { timeout?: number } = {}
  ): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/ai${endpoint}`;
    const headers = await this.buildHeaders();

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
        const txt = await res.text().catch(() => '');
        throw new Error(`Backend AI error: ${res.status} ${txt.slice(0, 200)}`);
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
    const result = await this.request<{ text: string }>('/generate', {
      prompt,
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxTokens,
      model: options.model,
      systemPrompt: options.systemPrompt,
    }, { timeout: options.timeout });

    return result.text;
  }

  /**
   * Chat completion with message history
   */
  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    return this.request<ChatResult>('/auto-chat', {
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      model: options.model,
    }, { timeout: options.timeout });
  }

  /**
   * Vision analysis with image
   */
  async vision(
    imageData: string,
    prompt: string,
    options: VisionOptions = {}
  ): Promise<string> {
    const result = await this.request<{ description: string }>('/vision/analyze', {
      imageBase64: imageData,
      mimeType: options.mimeType || 'image/jpeg',
      prompt,
      model: options.model,
    }, { timeout: options.timeout });

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

      const json = tryParseJson<T>(text);
      if (json && typeof json === 'object') {
        return { ok: true, data: json };
      }

      // Fallback if JSON parsing fails
      return { ok: true, data: getFallbackData(mode, payload) as T };
    } catch (err) {
      console.error(`[AIService:${mode}] Error:`, err instanceof Error ? err.message : err);
      return { ok: true, data: getFallbackData(mode, payload) as T };
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
   * Checks backend API availability directly (not /ai/health to avoid circular calls).
   * Uses /api/v1/healthz which is a simple health endpoint.
   */
  async health(): Promise<{ ok: boolean; provider?: string; status?: string }> {
    try {
      // Use BACKEND_ORIGIN directly to check backend health
      // Avoid calling /ai/health which may have issues with opencode-backend
      const backendOrigin = this.env.BACKEND_ORIGIN;
      
      if (!backendOrigin) {
        return { 
          ok: false, 
          status: 'BACKEND_ORIGIN not configured',
          provider: 'unknown'
        };
      }

      const url = `${backendOrigin.replace(/\/$/, '')}/api/v1/healthz`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Blog-Workers/1.0',
        },
      });

      if (!res.ok) {
        return { ok: false, status: `HTTP ${res.status}`, provider: 'backend' };
      }

      const data = (await res.json()) as {
        ok?: boolean;
        env?: string;
        uptime?: number;
      };

      return {
        ok: data.ok ?? true,
        provider: 'backend',
        status: data.ok ? 'healthy' : 'degraded',
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
    // Return static info - the actual provider is determined by backend config
    // We don't need to call backend /ai/status which may fail
    return {
      provider: 'backend-proxy',
      features: {
        chat: true,
        generate: true,
        vision: true,
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
  if (!text || typeof text !== 'string') return null;

  // 1. 직접 파싱 시도
  try {
    return JSON.parse(text) as T;
  } catch {
    // continue
  }

  // 2. ```json 코드블록 추출
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // continue
    }
  }

  // 3. 첫 { ~ 마지막 } 서브스트링
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch {
      // continue
    }
  }

  return null;
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
