-- Migration: 0030_subscriber_tokens
-- Description: Backfill persistent subscriber tokens for token-only unsubscribe flows

UPDATE subscribers
SET confirm_token = lower(hex(randomblob(16))) || lower(hex(randomblob(16))),
    updated_at = datetime('now')
WHERE confirm_token IS NULL;
