-- Migration: 0032_auth_refresh_totp_state
-- Description: Move admin refresh-token rotation and TOTP replay state from KV to D1 CAS primitives.

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  jti TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  sub TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'rotated', 'revoked')),
  created_at TEXT NOT NULL,
  rotated_at TEXT,
  replaced_by TEXT,
  reason TEXT,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_family
ON auth_refresh_tokens(family_id, status, expires_at);

CREATE TABLE IF NOT EXISTS auth_refresh_families (
  family_id TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  last_jti TEXT,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_families_expires_at
ON auth_refresh_families(expires_at);

CREATE TABLE IF NOT EXISTS auth_totp_state (
  id TEXT PRIMARY KEY,
  last_step INTEGER NOT NULL,
  consumed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

INSERT OR IGNORE INTO auth_totp_state (id, last_step, consumed_at, expires_at)
VALUES ('global', -1, '1970-01-01T00:00:00.000Z', '9999-12-31T23:59:59.999Z');
