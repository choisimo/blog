-- Migration: 0024_domain_outbox
-- Description: Create a generic domain outbox for eventual-consistency consumers

CREATE TABLE IF NOT EXISTS domain_outbox (
  id TEXT PRIMARY KEY,
  stream TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  locked_at TEXT,
  consumer_id TEXT,
  last_error TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_domain_outbox_stream_status_attempt
ON domain_outbox(stream, status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_domain_outbox_stream_locked
ON domain_outbox(stream, locked_at, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_outbox_stream_idempotency
ON domain_outbox(stream, idempotency_key)
WHERE idempotency_key IS NOT NULL;
