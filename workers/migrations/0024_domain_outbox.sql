CREATE TABLE IF NOT EXISTS domain_outbox (
  id TEXT PRIMARY KEY,
  stream TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  available_at TEXT NOT NULL,
  last_attempt_at TEXT,
  processed_at TEXT,
  last_error TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_outbox_idempotency
  ON domain_outbox (stream, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_domain_outbox_pending
  ON domain_outbox (stream, status, available_at, created_at);

CREATE INDEX IF NOT EXISTS idx_domain_outbox_aggregate
  ON domain_outbox (stream, aggregate_id, created_at DESC);
