-- =============================================================================
-- Standardize Secret Key Names
-- Migration: 0021_secrets_key_standardization.sql
--
-- Renames legacy key names to standardized names:
--   AI_SERVE_API_KEY  -> AI_API_KEY   (already exists, merge)
--   AI_SERVE_BASE_URL -> AI_SERVER_URL
-- =============================================================================

-- Remove the legacy AI_SERVE_API_KEY entry (AI_API_KEY already exists)
DELETE FROM secrets WHERE key_name = 'AI_SERVE_API_KEY';

-- Rename AI_SERVE_BASE_URL -> AI_SERVER_URL
UPDATE secrets 
SET key_name = 'AI_SERVER_URL',
    display_name = 'AI Server URL',
    description = 'URL for AI backend server (OpenAI-compatible API endpoint)',
    env_fallback = 'AI_SERVER_URL',
    updated_at = CURRENT_TIMESTAMP
WHERE key_name = 'AI_SERVE_BASE_URL';

-- Update any ai_provider references that pointed to the old secret
UPDATE ai_providers 
SET secret_id = 'sec_ai_api_key' 
WHERE secret_id = 'sec_ai_serve_api_key';

-- Clean up: remove old secret references
DELETE FROM secret_references WHERE secret_id = 'sec_ai_serve_api_key';
