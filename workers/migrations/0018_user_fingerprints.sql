-- Migration: 0018_user_fingerprints.sql
-- Purpose: FingerprintJS-based user session persistence and recovery

CREATE TABLE IF NOT EXISTS user_fingerprints (
  id TEXT PRIMARY KEY,
  fingerprint_hash TEXT NOT NULL UNIQUE,
  device_info TEXT,
  browser_info TEXT,
  os_info TEXT,
  screen_info TEXT,
  timezone TEXT,
  language TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  visit_count INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_fingerprints_hash ON user_fingerprints(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_user_fingerprints_active ON user_fingerprints(is_active, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  fingerprint_id TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  country_code TEXT,
  preferences TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (fingerprint_id) REFERENCES user_fingerprints(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_fingerprint ON user_sessions(fingerprint_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  fingerprint_id TEXT NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(fingerprint_id, preference_key),
  FOREIGN KEY (fingerprint_id) REFERENCES user_fingerprints(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_fingerprint ON user_preferences(fingerprint_id);
