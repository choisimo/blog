-- Migration: 0028_oauth_handoffs
-- Purpose: Short-lived one-time OAuth handoff records so raw JWTs do not travel in browser redirects.

CREATE TABLE IF NOT EXISTS oauth_handoffs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_handoffs_expires_at
ON oauth_handoffs(expires_at);
