/**
 * Shared AI Types
 * 
 * 모든 AI 관련 타입을 중앙에서 정의합니다.
 * Backend, Workers, Frontend에서 공유합니다.
 */

// ============================================================================
// Provider & Model Types
// ============================================================================

export type ProviderId = 'github-copilot' | 'openai' | 'gemini' | 'anthropic' | 'local';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  baseUrl: string;
  models: string[];
  features: ProviderFeatures;
  enabled: boolean;
}

export interface ProviderFeatures {
  chat: boolean;
  streaming: boolean;
  vision: boolean;
  functionCalling: boolean;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  timestamp?: number;
}

export interface ImageInput {
  base64: string;
  mimeType: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface ChatRequest {
  messages: Message[];
  provider?: ProviderId;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: ProviderId;
  usage?: TokenUsage;
  finishReason?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateRequest {
  prompt: string;
  provider?: ProviderId;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResponse {
  text: string;
  model: string;
  provider: ProviderId;
  usage?: TokenUsage;
}

// ============================================================================
// Task Types (Sketch, Prism, Chain, Summary)
// ============================================================================

export type TaskMode = 'sketch' | 'prism' | 'chain' | 'catalyst' | 'summary' | 'custom';

export interface TaskPayload {
  paragraph?: string;
  content?: string;
  postTitle?: string;
  title?: string;
  persona?: string;
  prompt?: string;
  [key: string]: unknown;
}

export interface SketchResult {
  mood: string;
  bullets: string[];
}

export interface PrismFacet {
  title: string;
  points: string[];
}

export interface PrismResult {
  facets: PrismFacet[];
}

export interface ChainQuestion {
  q: string;
  why: string;
}

export interface ChainResult {
  questions: ChainQuestion[];
}

export interface SummaryResult {
  summary: string;
  keyPoints?: string[];
}

export type TaskResult = SketchResult | PrismResult | ChainResult | SummaryResult;

// ============================================================================
// Health & Status Types
// ============================================================================

export interface HealthStatus {
  ok: boolean;
  status?: string;
  tokenReady?: boolean;
  error?: string;
  cached?: boolean;
  timestamp: number;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailure: number;
  threshold: number;
  resetTimeMs: number;
}

// ============================================================================
// Logging Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AILogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  operation: string;
  requestId?: string;
  provider?: ProviderId;
  model?: string;
  duration?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AIRoutingConfig {
  defaultProvider: ProviderId;
  defaultModel: string;
  fallbackProviders: ProviderId[];
  timeout: number;
  retryAttempts: number;
}

export interface AIConfig {
  providers: ProviderConfig[];
  routing: AIRoutingConfig;
  circuitBreaker: {
    threshold: number;
    resetTimeMs: number;
  };
  logging: {
    enabled: boolean;
    level: LogLevel;
    includeMetrics: boolean;
  };
}
