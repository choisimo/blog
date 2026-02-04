/**
 * Centralized AI Configuration
 * 
 * 모든 AI 서비스 설정을 중앙에서 관리합니다.
 * 환경변수로 오버라이드 가능합니다.
 */

import type { AIConfig, ProviderId, ProviderConfig } from '../types/ai';

// ============================================================================
// Environment Variable Helpers
// ============================================================================

function getEnv(key: string, defaultValue: string): string {
  const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  if (env) return env[key] || defaultValue;
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
// Provider Definitions
// ============================================================================

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: 'openai' as ProviderId,
    name: 'OpenAI-Compatible',
    baseUrl: getEnv('AI_SERVER_URL', 'https://api.openai.com/v1'),
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'claude-sonnet-4',
      'claude-3.5-sonnet',
      'gemini-2.0-flash',
    ],
    features: {
      chat: true,
      streaming: true,
      vision: true,
      functionCalling: true,
    },
    enabled: true,
  },
  local: {
    id: 'local',
    name: 'Local LLM',
    baseUrl: getEnv('AI_LOCAL_URL', 'http://localhost:11434'),
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
    defaultProvider: getEnv('AI_DEFAULT_PROVIDER', 'openai') as ProviderId,
    defaultModel: getEnv('AI_DEFAULT_MODEL', 'gpt-4.1'),
    fallbackProviders: ['local'],
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
// Timeout Configuration
// ============================================================================

export const TIMEOUTS = {
  default: getEnvNumber('AI_TIMEOUT_MS', 120000),
  long: getEnvNumber('AI_LONG_TIMEOUT_MS', 300000),
  health: getEnvNumber('AI_HEALTH_TIMEOUT_MS', 5000),
  stream: getEnvNumber('AI_STREAM_TIMEOUT_MS', 180000),
};

// ============================================================================
// Model Aliases (for convenience)
// ============================================================================
// Use these in your code instead of provider-specific names

export const MODELS = {
  default: getEnv('AI_DEFAULT_MODEL', 'gpt-4.1'),
  
  fast: 'gpt-4o-mini',
  
  smart: 'gpt-4o',
  smartVision: 'gpt-4o',
  
  code: 'gpt-4.1',
  
  longContext: 'gemini-2.0-flash',
  
  cheap: 'gpt-4.1-nano',
  
  claude: 'claude-sonnet-4',
};
