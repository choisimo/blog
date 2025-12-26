/**
 * AI Model Management Types
 */

export interface AIProvider {
  id: string;
  name: string;
  displayName: string;
  apiBaseUrl: string | null;
  apiKeyEnv: string | null;
  isEnabled: boolean;
  healthStatus: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastHealthCheck: string | null;
  modelCount: number;
  enabledModelCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIModel {
  id: string;
  modelName: string;
  displayName: string;
  litellmModel: string;
  description: string | null;
  provider: {
    id: string;
    name: string;
    displayName: string;
    isEnabled?: boolean;
  };
  contextWindow: number | null;
  maxTokens: number | null;
  cost: {
    inputPer1k: number | null;
    outputPer1k: number | null;
  };
  capabilities: {
    vision: boolean;
    streaming: boolean;
    functionCalling: boolean;
  };
  isEnabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIRoute {
  id: string;
  name: string;
  description: string | null;
  routingStrategy: 'simple' | 'latency-based-routing' | 'cost-based-routing';
  primaryModel: {
    id: string;
    modelName: string;
    displayName: string;
  } | null;
  fallbackModelIds: string[];
  contextWindowFallbackIds: string[];
  numRetries: number;
  timeoutSeconds: number;
  isDefault: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIUsageSummary {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  successCount: number;
  errorCount: number;
}

export interface AIUsageBreakdown {
  date?: string;
  model?: {
    id: string;
    modelName: string;
    displayName: string;
  };
  requests: number;
  tokens: number;
  cost: number;
  avgLatencyMs: number;
}

export interface AIUsageData {
  period: {
    start: string;
    end: string;
  };
  summary: AIUsageSummary;
  breakdown: AIUsageBreakdown[];
}

// Form types
export interface ProviderFormData {
  name: string;
  displayName: string;
  apiBaseUrl?: string;
  apiKeyEnv?: string;
}

export interface ModelFormData {
  modelName: string;
  displayName: string;
  providerId: string;
  litellmModel: string;
  description?: string;
  contextWindow?: number;
  maxTokens?: number;
  inputCostPer1k?: number;
  outputCostPer1k?: number;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
  supportsFunctionCalling?: boolean;
  priority?: number;
}

export interface RouteFormData {
  name: string;
  description?: string;
  routingStrategy?: 'simple' | 'latency-based-routing' | 'cost-based-routing';
  primaryModelId?: string;
  fallbackModelIds?: string[];
  contextWindowFallbackIds?: string[];
  numRetries?: number;
  timeoutSeconds?: number;
  isDefault?: boolean;
}
