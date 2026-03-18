-- =============================================================================
-- Normalize OpenAI Provider Key Ownership
-- Migration: 0023_openai_key_ownership.sql
--
-- prov_openai was seeded with api_key_env='AI_API_KEY' and
-- secret_id='sec_ai_api_key'. AI_API_KEY is the gateway-level default key,
-- not a provider-specific key. This migration reassigns prov_openai to
-- OPENAI_API_KEY / sec_openai_api_key (already present from 0015 seed).
-- =============================================================================

UPDATE ai_providers
SET api_key_env = 'OPENAI_API_KEY',
    secret_id   = 'sec_openai_api_key',
    updated_at  = CURRENT_TIMESTAMP
WHERE id = 'prov_openai';
