-- =============================================================================
-- AI Model Management - Seed Data
-- Migration: 0012_ai_model_seed.sql
-- Based on: backend/litellm_config.yaml
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Providers
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_providers (id, name, display_name, api_base_url, api_key_env) VALUES
  ('prov_github', 'github', 'GitHub Models', 'https://models.inference.ai.azure.com', 'GITHUB_TOKEN'),
  ('prov_openai', 'openai', 'OpenAI', 'https://api.openai.com/v1', 'OPENAI_API_KEY'),
  ('prov_ollama', 'ollama', 'Ollama (Local)', 'http://host.docker.internal:11434', NULL);

-- -----------------------------------------------------------------------------
-- Models - GitHub Models (Primary)
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_models (
  id, provider_id, model_name, display_name, litellm_model, description,
  context_window, max_tokens, input_cost_per_1k, output_cost_per_1k,
  supports_vision, supports_streaming, supports_function_calling, priority
) VALUES
  ('model_gh_gpt41', 'prov_github', 'gpt-4.1', 'GPT-4.1 (GitHub)', 'github/gpt-4.1',
   'GitHub Models GPT-4.1 - Primary model', 128000, 4096, 0.002, 0.008, 1, 1, 1, 100),

  ('model_gh_gpt4o', 'prov_github', 'gpt-4o', 'GPT-4o (GitHub)', 'github/gpt-4o',
   'GitHub Models GPT-4o', 128000, 4096, 0.005, 0.015, 1, 1, 1, 95),

  ('model_gh_gpt4o_mini', 'prov_github', 'gpt-4o-mini', 'GPT-4o Mini (GitHub)', 'github/gpt-4o-mini',
   'GitHub Models GPT-4o Mini - Efficient', 128000, 16384, 0.00015, 0.0006, 1, 1, 1, 90),

  ('model_gh_gpt41_mini', 'prov_github', 'gpt-4.1-mini', 'GPT-4.1 Mini (GitHub)', 'github/gpt-4.1-mini',
   'GitHub Models GPT-4.1 Mini', 128000, 4096, 0.0004, 0.0016, 1, 1, 1, 89),

  ('model_gh_gpt41_nano', 'prov_github', 'gpt-4.1-nano', 'GPT-4.1 Nano (GitHub)', 'github/gpt-4.1-nano',
   'GitHub Models GPT-4.1 Nano', 128000, 4096, 0.0001, 0.0004, 1, 1, 1, 88),

  ('model_gh_claude', 'prov_github', 'claude-sonnet-4', 'Claude Sonnet 4 (GitHub)', 'github/claude-sonnet-4-20250514',
   'GitHub Models Claude Sonnet 4', 200000, 4096, 0.003, 0.015, 1, 1, 1, 85),

  ('model_gh_claude35', 'prov_github', 'claude-3.5-sonnet', 'Claude 3.5 Sonnet (GitHub)', 'github/claude-3.5-sonnet',
   'GitHub Models Claude 3.5 Sonnet', 200000, 8192, 0.003, 0.015, 1, 1, 1, 84),

  ('model_gh_gemini2', 'prov_github', 'gemini-2.0-flash', 'Gemini 2.0 Flash (GitHub)', 'github/gemini-2.0-flash',
   'GitHub Models Gemini 2.0 Flash', 1048576, 8192, 0.000075, 0.0003, 1, 1, 1, 80);

-- -----------------------------------------------------------------------------
-- Models - OpenAI Direct (Embeddings only)
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_models (
  id, provider_id, model_name, display_name, litellm_model, description,
  context_window, max_tokens, input_cost_per_1k, output_cost_per_1k,
  supports_vision, supports_streaming, supports_function_calling, priority
) VALUES
  ('model_oai_embed_small', 'prov_openai', 'text-embedding-3-small', 'Embedding Small (OpenAI)', 'text-embedding-3-small',
   'OpenAI Embedding Small', 8191, 0, 0.00002, 0, 0, 0, 0, 50);

-- -----------------------------------------------------------------------------
-- Models - Local (Ollama)
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_models (
  id, provider_id, model_name, display_name, litellm_model, description,
  context_window, max_tokens, input_cost_per_1k, output_cost_per_1k,
  supports_vision, supports_streaming, supports_function_calling, is_enabled, priority
) VALUES
  ('model_local_llama', 'prov_ollama', 'local/llama3', 'Llama 3 (Local)', 'ollama/llama3',
   'Local Llama 3 via Ollama - Development/testing', 8192, 2048, 0, 0, 0, 1, 0, 0, 10);

-- -----------------------------------------------------------------------------
-- Routes - Default routing configuration
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO ai_routes (
  id, name, description, routing_strategy, primary_model_id,
  fallback_model_ids, context_window_fallback_ids, num_retries, timeout_seconds, is_default
) VALUES
  ('route_default', 'default', 'Default routing - GPT-4.1 primary with Claude/Gemini fallback',
   'simple-shuffle', 'model_gh_gpt41',
   '["model_gh_claude", "model_gh_gemini2"]',
   '["model_gh_gemini2"]',
   3, 120, 1);
