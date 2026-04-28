-- Migration: 0036_idempotency_records
-- Description: Durable response cache for Idempotency-Key protected writes.

CREATE TABLE IF NOT EXISTS idempotency_records (
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT,
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  state TEXT NOT NULL DEFAULT 'completed',
  locked_until TEXT,
  PRIMARY KEY (scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_expires
ON idempotency_records(expires_at);
