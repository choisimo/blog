-- =============================================================================
-- AI Model Management - Seed Data
-- Migration: 0012_ai_model_seed.sql
-- Based on: backend/litellm_config.yaml
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Providers
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_providers (id, name, display_name, api_base_url, api_key_env) VALUES
  ('prov_vas', 'vas', 'GitHub Copilot (VAS)', 'http://vas-core:7012/v1', 'VAS_API_KEY'),
  ('prov_openai', 'openai', 'OpenAI', 'https://api.openai.com/v1', 'OPENAI_API_KEY'),
  ('prov_gemini', 'gemini', 'Google Gemini', NULL, 'GOOGLE_API_KEY'),
  ('prov_anthropic', 'anthropic', 'Anthropic Claude', 'https://api.anthropic.com', 'ANTHROPIC_API_KEY'),
  ('prov_ollama', 'ollama', 'Ollama (Local)', 'http://host.docker.internal:11434', NULL);

-- -----------------------------------------------------------------------------
-- Models - GitHub Copilot (VAS)
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_models (
  id, provider_id, model_name, display_name, litellm_model, description,
  context_window, max_tokens, input_cost_per_1k, output_cost_per_1k,
  supports_vision, supports_streaming, supports_function_calling, priority
) VALUES
  ('model_vas_gpt41', 'prov_vas', 'gpt-4.1', 'GPT-4.1 (GitHub Copilot)', 'openai/gpt-4.1',
   'GitHub Copilot GPT-4.1 via VAS - Primary model', 128000, 4096, 0.01, 0.03, 1, 1, 1, 100),

  ('model_vas_gpt4o', 'prov_vas', 'gpt-4o', 'GPT-4o (GitHub Copilot)', 'openai/gpt-4o',
   'GitHub Copilot GPT-4o via VAS', 128000, 4096, 0.005, 0.015, 1, 1, 1, 90),

  ('model_vas_claude', 'prov_vas', 'claude-sonnet-4', 'Claude Sonnet 4 (GitHub Copilot)', 'openai/claude-sonnet-4',
   'GitHub Copilot Claude Sonnet 4 via VAS', 200000, 4096, 0.003, 0.015, 1, 1, 1, 85);

-- -----------------------------------------------------------------------------
-- Models - OpenAI Direct
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_models (
  id, provider_id, model_name, display_name, litellm_model, description,
  context_window, max_tokens, input_cost_per_1k, output_cost_per_1k,
  supports_vision, supports_streaming, supports_function_calling, priority
) VALUES
  ('model_oai_gpt4o', 'prov_openai', 'openai/gpt-4o', 'GPT-4o (Direct)', 'gpt-4o',
   'OpenAI GPT-4o Direct', 128000, 4096, 0.005, 0.015, 1, 1, 1, 70),

  ('model_oai_gpt4t', 'prov_openai', 'openai/gpt-4-turbo', 'GPT-4 Turbo (Direct)', 'gpt-4-turbo',
   'OpenAI GPT-4 Turbo Direct', 128000, 4096, 0.01, 0.03, 1, 1, 1, 60),

  ('model_oai_gpt35', 'prov_openai', 'openai/gpt-3.5-turbo', 'GPT-3.5 Turbo (Direct)', 'gpt-3.5-turbo',
   'OpenAI GPT-3.5 Turbo Direct - Fast and cheap', 16385, 4096, 0.0005, 0.0015, 0, 1, 1, 50);

-- -----------------------------------------------------------------------------
-- Models - Google Gemini
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_models (
  id, provider_id, model_name, display_name, litellm_model, description,
  context_window, max_tokens, input_cost_per_1k, output_cost_per_1k,
  supports_vision, supports_streaming, supports_function_calling, priority
) VALUES
  ('model_gem_flash', 'prov_gemini', 'gemini-1.5-flash', 'Gemini 1.5 Flash', 'gemini/gemini-1.5-flash',
   'Google Gemini 1.5 Flash - Fast and cheap fallback', 1000000, 8192, 0.00035, 0.0014, 1, 1, 1, 80),

  ('model_gem_pro', 'prov_gemini', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 'gemini/gemini-1.5-pro',
   'Google Gemini 1.5 Pro - Long context specialist', 1000000, 8192, 0.00125, 0.005, 1, 1, 1, 75),

  ('model_gem_flash2', 'prov_gemini', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 'gemini/gemini-2.0-flash-exp',
   'Google Gemini 2.0 Flash Experimental', 1000000, 8192, 0.00035, 0.0014, 1, 1, 1, 78);

-- -----------------------------------------------------------------------------
-- Models - Anthropic Claude
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_models (
  id, provider_id, model_name, display_name, litellm_model, description,
  context_window, max_tokens, input_cost_per_1k, output_cost_per_1k,
  supports_vision, supports_streaming, supports_function_calling, priority
) VALUES
  ('model_ant_sonnet', 'prov_anthropic', 'claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'claude-3-5-sonnet-20241022',
   'Anthropic Claude 3.5 Sonnet - Best balance', 200000, 4096, 0.003, 0.015, 1, 1, 1, 65),

  ('model_ant_opus', 'prov_anthropic', 'claude-3-opus', 'Claude 3 Opus', 'claude-3-opus-20240229',
   'Anthropic Claude 3 Opus - Most capable', 200000, 4096, 0.015, 0.075, 1, 1, 1, 55),

  ('model_ant_haiku', 'prov_anthropic', 'claude-3-haiku', 'Claude 3 Haiku', 'claude-3-haiku-20240307',
   'Anthropic Claude 3 Haiku - Fast and cheap', 200000, 4096, 0.00025, 0.00125, 1, 1, 1, 60);

-- -----------------------------------------------------------------------------
-- Models - Local (Ollama)
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_models (
  id, provider_id, model_name, display_name, litellm_model, description,
  context_window, max_tokens, input_cost_per_1k, output_cost_per_1k,
  supports_vision, supports_streaming, supports_function_calling, is_enabled, priority
) VALUES
  ('model_local_llama', 'prov_ollama', 'local/llama3', 'Llama 3 (Local)', 'ollama/llama3',
   'Local Llama 3 via Ollama - Development/testing', 8192, 2048, 0, 0, 0, 1, 0, 0, 10),

  ('model_local_code', 'prov_ollama', 'local/codellama', 'CodeLlama (Local)', 'ollama/codellama',
   'Local CodeLlama via Ollama - Code tasks', 16384, 2048, 0, 0, 0, 1, 0, 0, 10);

-- -----------------------------------------------------------------------------
-- Routes - Default routing configuration
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_routes (
  id, name, description, routing_strategy, primary_model_id,
  fallback_model_ids, context_window_fallback_ids, num_retries, timeout_seconds, is_default
) VALUES
  ('route_default', 'default', 'Default routing - GPT-4.1 primary with Gemini/Claude fallback',
   'latency-based-routing', 'model_vas_gpt41',
   '["model_gem_flash", "model_ant_haiku"]',
   '["model_gem_pro"]',
   3, 120, 1),

  ('route_fast', 'fast', 'Fast routing - Optimized for speed',
   'latency-based-routing', 'model_gem_flash',
   '["model_ant_haiku", "model_oai_gpt35"]',
   NULL,
   2, 60, 0),

  ('route_quality', 'quality', 'Quality routing - Best models first',
   'simple', 'model_vas_gpt4o',
   '["model_gem_pro", "model_ant_sonnet"]',
   '["model_gem_pro"]',
   3, 180, 0),

  ('route_long_context', 'long-context', 'Long context routing - For large documents',
   'simple', 'model_gem_pro',
   '["model_ant_sonnet", "model_vas_claude"]',
   NULL,
   2, 180, 0);
