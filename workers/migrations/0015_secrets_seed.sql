-- =============================================================================
-- Seed Secrets from Environment Variables
-- Migration: 0015_secrets_seed.sql
--
-- This migration pre-populates the secrets table with common keys.
-- Actual values will be set via Admin UI or API.
-- =============================================================================

-- AI Provider Keys
INSERT OR IGNORE INTO secrets (id, category_id, key_name, display_name, description, is_required, is_sensitive, value_type, env_fallback) VALUES
  ('sec_ai_api_key', 'cat_ai', 'AI_API_KEY', 'AI API Key', 'Primary API key for OpenAI-compatible AI server', 0, 1, 'string', 'AI_API_KEY'),
  ('sec_openai_api_key', 'cat_ai', 'OPENAI_API_KEY', 'OpenAI API Key', 'API key for OpenAI GPT models', 0, 1, 'string', 'OPENAI_API_KEY'),
  ('sec_anthropic_api_key', 'cat_ai', 'ANTHROPIC_API_KEY', 'Anthropic API Key', 'API key for Claude models', 0, 1, 'string', 'ANTHROPIC_API_KEY'),
  ('sec_google_api_key', 'cat_ai', 'GOOGLE_API_KEY', 'Google API Key', 'API key for Google Gemini models', 0, 1, 'string', 'GOOGLE_API_KEY'),
  ('sec_gemini_api_key', 'cat_ai', 'GEMINI_API_KEY', 'Gemini API Key', 'Alternative key for Google Gemini (same as GOOGLE_API_KEY)', 0, 1, 'string', 'GEMINI_API_KEY'),
  ('sec_openrouter_api_key', 'cat_ai', 'OPENROUTER_API_KEY', 'OpenRouter API Key', 'API key for OpenRouter multi-model gateway', 0, 1, 'string', 'OPENROUTER_API_KEY'),
  ('sec_vas_api_key', 'cat_ai', 'VAS_API_KEY', 'GitHub Copilot VAS Key', 'API key for GitHub Copilot VAS models', 0, 1, 'string', 'VAS_API_KEY'),
  ('sec_ai_serve_api_key', 'cat_ai', 'AI_SERVE_API_KEY', 'AI Serve API Key', 'Internal API key for AI backend server', 0, 1, 'string', 'AI_SERVE_API_KEY'),
  ('sec_ai_gateway_caller_key', 'cat_ai', 'AI_GATEWAY_CALLER_KEY', 'AI Gateway Caller Key', 'Key for authenticating calls to AI gateway', 0, 1, 'string', 'AI_GATEWAY_CALLER_KEY');

-- Authentication Secrets
INSERT OR IGNORE INTO secrets (id, category_id, key_name, display_name, description, is_required, is_sensitive, value_type, env_fallback) VALUES
  ('sec_jwt_secret', 'cat_auth', 'JWT_SECRET', 'JWT Secret', 'Secret key for signing JWT tokens (required)', 1, 1, 'string', 'JWT_SECRET'),
  ('sec_admin_username', 'cat_auth', 'ADMIN_USERNAME', 'Admin Username', 'Username for admin login', 1, 0, 'string', 'ADMIN_USERNAME'),
  ('sec_admin_password', 'cat_auth', 'ADMIN_PASSWORD', 'Admin Password', 'Password for admin login', 1, 1, 'string', 'ADMIN_PASSWORD'),
  ('sec_admin_email', 'cat_auth', 'ADMIN_EMAIL', 'Admin Email', 'Email address for OTP verification', 1, 0, 'string', 'ADMIN_EMAIL'),
  ('sec_admin_bearer_token', 'cat_auth', 'ADMIN_BEARER_TOKEN', 'Admin Bearer Token', 'Legacy bearer token for admin API', 0, 1, 'string', 'ADMIN_BEARER_TOKEN'),
  ('sec_origin_secret_key', 'cat_auth', 'ORIGIN_SECRET_KEY', 'Origin Secret Key', 'Secret key for WebSocket origin verification', 0, 1, 'string', 'ORIGIN_SECRET_KEY'),
  ('sec_opencode_auth_token', 'cat_auth', 'OPENCODE_AUTH_TOKEN', 'OpenCode Auth Token', 'Authentication token for OpenCode integration', 0, 1, 'string', 'OPENCODE_AUTH_TOKEN');

-- Email & Notification Secrets
INSERT OR IGNORE INTO secrets (id, category_id, key_name, display_name, description, is_required, is_sensitive, value_type, env_fallback) VALUES
  ('sec_resend_api_key', 'cat_email', 'RESEND_API_KEY', 'Resend API Key', 'API key for Resend email service', 0, 1, 'string', 'RESEND_API_KEY'),
  ('sec_notify_from_email', 'cat_email', 'NOTIFY_FROM_EMAIL', 'Notification From Email', 'Email address for sending notifications', 0, 0, 'string', 'NOTIFY_FROM_EMAIL'),
  ('sec_notify_to_emails', 'cat_email', 'NOTIFY_TO_EMAILS', 'Notification Recipients', 'Comma-separated list of notification recipient emails', 0, 0, 'string', 'NOTIFY_TO_EMAILS');

-- GitHub Integration
INSERT OR IGNORE INTO secrets (id, category_id, key_name, display_name, description, is_required, is_sensitive, value_type, env_fallback) VALUES
  ('sec_github_token', 'cat_github', 'GITHUB_TOKEN', 'GitHub Token', 'Personal access token for GitHub API (repo, PR creation)', 0, 1, 'string', 'GITHUB_TOKEN');

-- General/URLs Configuration
INSERT OR IGNORE INTO secrets (id, category_id, key_name, display_name, description, is_required, is_sensitive, value_type, env_fallback) VALUES
  ('sec_api_base_url', 'cat_general', 'API_BASE_URL', 'API Base URL', 'Base URL for API endpoints', 0, 0, 'url', 'API_BASE_URL'),
  ('sec_public_site_url', 'cat_general', 'PUBLIC_SITE_URL', 'Public Site URL', 'Public-facing website URL', 0, 0, 'url', 'PUBLIC_SITE_URL'),
  ('sec_assets_base_url', 'cat_general', 'ASSETS_BASE_URL', 'Assets Base URL', 'Base URL for static assets', 0, 0, 'url', 'ASSETS_BASE_URL'),
  ('sec_ai_serve_base_url', 'cat_general', 'AI_SERVE_BASE_URL', 'AI Serve Base URL', 'URL for AI backend server', 0, 0, 'url', 'AI_SERVE_BASE_URL');

-- =============================================================================
-- Link AI Providers to Secrets
-- =============================================================================

-- Update existing ai_providers to use secret_id
UPDATE ai_providers SET secret_id = 'sec_ai_api_key' WHERE name = 'openai' AND secret_id IS NULL;
UPDATE ai_providers SET secret_id = 'sec_anthropic_api_key' WHERE name = 'anthropic' AND secret_id IS NULL;
UPDATE ai_providers SET secret_id = 'sec_gemini_api_key' WHERE name = 'gemini' AND secret_id IS NULL;
UPDATE ai_providers SET secret_id = 'sec_google_api_key' WHERE name = 'google' AND secret_id IS NULL;
UPDATE ai_providers SET secret_id = 'sec_vas_api_key' WHERE name = 'vas' AND secret_id IS NULL;
UPDATE ai_providers SET secret_id = 'sec_openrouter_api_key' WHERE name = 'openrouter' AND secret_id IS NULL;
