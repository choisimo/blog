-- =============================================================================
-- AI Model Management System
-- Migration: 0011_ai_model_management.sql
-- =============================================================================

-- AI Provider 관리
CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,              -- 'openai', 'anthropic', 'gemini', 'vas', 'ollama'
  display_name TEXT NOT NULL,             -- 'OpenAI', 'Anthropic Claude'
  api_base_url TEXT,                      -- Provider API URL (optional)
  api_key_env TEXT,                       -- 환경변수 이름 (보안: 실제 키 저장 안함)
  is_enabled INTEGER DEFAULT 1,
  health_status TEXT DEFAULT 'unknown',   -- 'healthy', 'degraded', 'down', 'unknown'
  last_health_check TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- AI 모델 관리
CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_name TEXT NOT NULL UNIQUE,        -- 'gpt-4.1' (LiteLLM에서 사용하는 이름)
  display_name TEXT NOT NULL,             -- 'GPT-4.1 (GitHub Copilot)'
  litellm_model TEXT NOT NULL,            -- 'openai/gpt-4.1' (실제 LiteLLM 모델명)
  description TEXT,
  context_window INTEGER,                 -- 128000
  max_tokens INTEGER,                     -- 4096
  input_cost_per_1k REAL,                 -- $0.01
  output_cost_per_1k REAL,                -- $0.03
  supports_vision INTEGER DEFAULT 0,
  supports_streaming INTEGER DEFAULT 1,
  supports_function_calling INTEGER DEFAULT 0,
  is_enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,             -- 높을수록 우선 사용
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE CASCADE
);

-- 라우팅 규칙
CREATE TABLE IF NOT EXISTS ai_routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,              -- 'default', 'high-context', 'fast'
  description TEXT,
  routing_strategy TEXT DEFAULT 'latency-based-routing', -- 'simple', 'latency-based-routing', 'cost-based-routing'
  primary_model_id TEXT,
  fallback_model_ids TEXT,                -- JSON array of model IDs
  context_window_fallback_ids TEXT,       -- JSON array for long context
  num_retries INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 120,
  is_default INTEGER DEFAULT 0,
  is_enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (primary_model_id) REFERENCES ai_models(id) ON DELETE SET NULL
);

-- 사용량 로그 (개별 요청)
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id TEXT PRIMARY KEY,
  model_id TEXT,
  route_id TEXT,
  request_type TEXT,                      -- 'chat', 'completion', 'embedding', 'vision'
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost REAL,
  latency_ms INTEGER,
  status TEXT,                            -- 'success', 'error', 'timeout'
  error_message TEXT,
  user_id TEXT,
  metadata TEXT,                          -- JSON for additional info
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE SET NULL,
  FOREIGN KEY (route_id) REFERENCES ai_routes(id) ON DELETE SET NULL
);

-- 일별 사용량 집계
CREATE TABLE IF NOT EXISTS ai_usage_daily (
  date TEXT NOT NULL,
  model_id TEXT NOT NULL,
  total_requests INTEGER DEFAULT 0,
  total_prompt_tokens INTEGER DEFAULT 0,
  total_completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_latency_ms REAL,
  PRIMARY KEY (date, model_id),
  FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_models_enabled ON ai_models(is_enabled);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model ON ai_usage_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_date ON ai_usage_daily(date);
