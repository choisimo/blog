/**
 * Centralized AI Configuration
 * 
 * 모든 AI 서비스 설정을 중앙에서 관리합니다.
 * n8n Workflow Engine을 통해 모든 Provider에 접근합니다.
 * 환경변수로 오버라이드 가능합니다.
 */

import type { AIConfig, ProviderId, ProviderConfig };

// ============================================================================
// Environment Variable Helpers
// ============================================================================

function getEnv(key: string, defaultValue: string): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = getEnv(key, String(defaultValue));
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = getEnv(key, String(defaultValue));
  return value === 'true' || value === '1';
}

// ============================================================================
// n8n Workflow Engine Configuration (Primary)
// ============================================================================

export const N8N_CONFIG = {
  // Base URL for n8n webhooks
  baseUrl: getEnv('N8N_WEBHOOK_URL', 'http://n8n:5678'),
  
  // API key for authentication (optional)
  apiKey: getEnv('N8N_API_KEY', ''),
  
  // Default model (will be routed by n8n workflow)
  defaultModel: getEnv('AI_DEFAULT_MODEL', 'gemini-1.5-flash'),
  
  // Timeout settings
  timeout: getEnvNumber('AI_TIMEOUT_MS', 120000),
  longTimeout: getEnvNumber('AI_LONG_TIMEOUT_MS', 300000),
  
  // Retry settings (n8n handles retries in workflows)
  retryAttempts: getEnvNumber('AI_RETRY_ATTEMPTS', 2),
};

// ============================================================================
// Provider Definitions (Reference - actual routing handled by n8n workflows)
// ============================================================================

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  'github-copilot': {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    baseUrl: 'auto', // Routed through n8n → opencode-engine
    models: ['gpt-4.1', 'gpt-4o', 'gpt-4-turbo', 'o1-mini', 'claude-sonnet-4'],
    features: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
    },
    enabled: true,
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1', // Routed through n8n
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    features: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
    },
    enabled: getEnvBoolean('AI_OPENAI_ENABLED', false),
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta', // Routed through n8n
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
    features: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
    },
    enabled: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1', // Routed through n8n
    models: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
    features: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: false,
    },
    enabled: getEnvBoolean('AI_ANTHROPIC_ENABLED', false),
  },
  local: {
    id: 'local',
    name: 'Local LLM',
    baseUrl: getEnv('AI_LOCAL_URL', 'http://localhost:11434'), // Routed through n8n
    models: ['llama3', 'codellama', 'mistral'],
    features: {
      chat: true,
      streaming: true,
      vision: false,
      functionCalling: false,
    },
    enabled: getEnvBoolean('AI_LOCAL_ENABLED', false),
  },
};

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_AI_CONFIG: AIConfig = {
  providers: Object.values(PROVIDERS),
  routing: {
    defaultProvider: getEnv('AI_DEFAULT_PROVIDER', 'gemini') as ProviderId,
    defaultModel: getEnv('AI_DEFAULT_MODEL', 'gemini-1.5-flash'),
    fallbackProviders: ['gemini'], // n8n handles fallbacks in workflows
    timeout: getEnvNumber('AI_TIMEOUT_MS', 120000),
    retryAttempts: getEnvNumber('AI_RETRY_ATTEMPTS', 2),
  },
  circuitBreaker: {
    threshold: getEnvNumber('AI_CB_THRESHOLD', 5),
    resetTimeMs: getEnvNumber('AI_CB_RESET_MS', 30000),
  },
  logging: {
    enabled: getEnvBoolean('AI_LOGGING_ENABLED', true),
    level: getEnv('AI_LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
    includeMetrics: getEnvBoolean('AI_LOG_METRICS', true),
  },
};

// ============================================================================
// Configuration Accessors
// ============================================================================

let _config: AIConfig = DEFAULT_AI_CONFIG;

/**
 * Get the current AI configuration
 */
export function getAIConfig(): AIConfig {
  return _config;
}

/**
 * Update the AI configuration (for runtime changes)
 */
export function setAIConfig(config: Partial<AIConfig>): void {
  _config = { ..._config, ...config };
}

/**
 * Get a specific provider configuration
 */
export function getProvider(id: ProviderId): ProviderConfig | undefined {
  return _config.providers.find(p => p.id === id);
}

/**
 * Get all enabled providers
 */
export function getEnabledProviders(): ProviderConfig[] {
  return _config.providers.filter(p => p.enabled);
}

/**
 * Check if a model is available for a provider
 */
export function isModelAvailable(providerId: ProviderId, model: string): boolean {
  const provider = getProvider(providerId);
  return provider?.enabled === true && provider.models.includes(model);
}

// ============================================================================
// URL Configuration
// ============================================================================

export const AI_URLS = {
  // n8n Workflow Engine (Primary - use this for all AI calls)
  n8n: N8N_CONFIG.baseUrl,
  n8nApi: `${N8N_CONFIG.baseUrl}/webhook`,
  
  // Legacy VAS endpoints (for GitHub Copilot auth only)
  vasCore: getEnv('VAS_CORE_URL', 'http://vas-core:7012'),
  vasAdmin: getEnv('VAS_ADMIN_URL', 'http://vas-admin:7080'),
  
  // Workers API
  workersApi: getEnv('WORKERS_API_URL', 'https://api.nodove.com'),
};

// ============================================================================
// Timeout Configuration
// ============================================================================

export const TIMEOUTS = {
  default: N8N_CONFIG.timeout,
  long: N8N_CONFIG.longTimeout,
  health: getEnvNumber('AI_HEALTH_TIMEOUT_MS', 5000),
  stream: getEnvNumber('AI_STREAM_TIMEOUT_MS', 180000),
};

// ============================================================================
// Model Aliases (for convenience)
// ============================================================================
// Use these in your code instead of provider-specific names
// n8n workflows will route to the correct provider automatically

export const MODELS = {
  // Default models
  default: N8N_CONFIG.defaultModel,
  
  // Fast models (for quick responses)
  fast: 'gemini-1.5-flash',
  
  // Smart models (for complex tasks)
  smart: 'gpt-4o',
  smartVision: 'gpt-4o',
  
  // Coding models
  code: 'gpt-4o',
  
  // Long context models
  longContext: 'gemini-1.5-pro',
  
  // Cost-effective models
  cheap: 'gemini-1.5-flash',
};
