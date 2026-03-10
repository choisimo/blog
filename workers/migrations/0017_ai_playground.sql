-- AI Playground System
-- Migration: 0017_ai_playground.sql

CREATE TABLE IF NOT EXISTS ai_playground_history (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT,
  system_prompt TEXT,
  user_prompt TEXT NOT NULL,
  model_id TEXT,
  model_name TEXT,
  provider_id TEXT,
  provider_name TEXT,
  response TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  latency_ms INTEGER,
  estimated_cost REAL,
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE SET NULL,
  FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_playground_user ON ai_playground_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_playground_created ON ai_playground_history(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_playground_model ON ai_playground_history(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_playground_status ON ai_playground_history(status);

CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT DEFAULT 'general',
  system_prompt TEXT,
  user_prompt_template TEXT NOT NULL,
  variables TEXT,
  default_model_id TEXT,
  default_temperature REAL DEFAULT 0.7,
  default_max_tokens INTEGER,
  is_public INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (default_model_id) REFERENCES ai_models(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_category ON ai_prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_public ON ai_prompt_templates(is_public);
