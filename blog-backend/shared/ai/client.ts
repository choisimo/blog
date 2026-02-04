/**
 * Unified AI Client Interface
 * 
 * 모든 AI 클라이언트가 구현해야 하는 인터페이스 정의
 */

import type {
  Message,
  ImageInput,
  ChatRequest,
  ChatResponse,
  GenerateRequest,
  GenerateResponse,
  HealthStatus,
  CircuitBreakerState,
  ProviderId,
  TaskMode,
  TaskPayload,
  TaskResult,
} from '../types/ai';

// ============================================================================
// Client Interface
// ============================================================================

/**
 * AI 클라이언트 인터페이스
 * Backend, Workers에서 각각 구현합니다.
 */
export interface IAIClient {
  /**
   * Chat completion with message history
   */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Simple text generation
   */
  generate(request: GenerateRequest): Promise<GenerateResponse>;

  /**
   * Vision analysis with image
   */
  vision(image: ImageInput, prompt: string, options?: Partial<GenerateRequest>): Promise<GenerateResponse>;

  /**
   * Health check
   */
  health(force?: boolean): Promise<HealthStatus>;

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitBreakerState;
}

/**
 * Task 처리 클라이언트 인터페이스
 * Sketch, Prism, Chain 등 구조화된 태스크용
 */
export interface ITaskClient {
  /**
   * Execute a structured task
   */
  executeTask<T extends TaskResult>(mode: TaskMode, payload: TaskPayload): Promise<T>;
}

// ============================================================================
// Abstract Base Client
// ============================================================================

/**
 * 공통 기능을 제공하는 추상 베이스 클래스
 */
export abstract class BaseAIClient implements IAIClient {
  protected circuitState: CircuitBreakerState = {
    isOpen: false,
    failures: 0,
    lastFailure: 0,
    threshold: 5,
    resetTimeMs: 30000,
  };

  constructor(circuitBreakerConfig?: Partial<CircuitBreakerState>) {
    if (circuitBreakerConfig) {
      this.circuitState = { ...this.circuitState, ...circuitBreakerConfig };
    }
  }

  // ============================================================================
  // Circuit Breaker Logic
  // ============================================================================

  protected isCircuitOpen(): boolean {
    if (!this.circuitState.isOpen) return false;

    const now = Date.now();
    if (now - this.circuitState.lastFailure > this.circuitState.resetTimeMs) {
      this.circuitState.isOpen = false;
      this.circuitState.failures = 0;
      return false;
    }

    return true;
  }

  protected recordFailure(): void {
    this.circuitState.failures++;
    this.circuitState.lastFailure = Date.now();

    if (this.circuitState.failures >= this.circuitState.threshold) {
      this.circuitState.isOpen = true;
    }
  }

  protected recordSuccess(): void {
    this.circuitState.failures = 0;
    this.circuitState.isOpen = false;
  }

  getCircuitState(): CircuitBreakerState {
    return { ...this.circuitState };
  }

  // ============================================================================
  // Abstract Methods (to be implemented by subclasses)
  // ============================================================================

  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  abstract generate(request: GenerateRequest): Promise<GenerateResponse>;
  abstract vision(image: ImageInput, prompt: string, options?: Partial<GenerateRequest>): Promise<GenerateResponse>;
  abstract health(force?: boolean): Promise<HealthStatus>;
}

// ============================================================================
// Response Utilities
// ============================================================================

/**
 * JSON 파싱 유틸리티
 * AI 응답에서 JSON을 추출합니다.
 */
export function tryParseJson<T = unknown>(text: string | null | undefined): T | null {
  if (!text || typeof text !== 'string') return null;

  // Direct parse
  try {
    return JSON.parse(text) as T;
  } catch {
    // continue
  }

  // Extract from code fence
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      // continue
    }
  }

  // Extract { } substring
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

/**
 * 텍스트 안전 자르기
 */
export function safeTruncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

// ============================================================================
// Error Types
// ============================================================================

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: ProviderId,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class CircuitOpenError extends AIError {
  constructor(provider?: ProviderId) {
    super('AI service temporarily unavailable (circuit breaker open)', 'CIRCUIT_OPEN', provider);
    this.name = 'CircuitOpenError';
  }
}

export class TimeoutError extends AIError {
  constructor(timeoutMs: number, provider?: ProviderId) {
    super(`Request timeout after ${timeoutMs}ms`, 'TIMEOUT', provider);
    this.name = 'TimeoutError';
  }
}
