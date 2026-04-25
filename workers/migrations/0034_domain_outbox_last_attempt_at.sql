-- Migration: 0034_domain_outbox_last_attempt_at
-- Description: Align persisted domain outbox schema with retry bookkeeping used by outbox processors.

ALTER TABLE domain_outbox ADD COLUMN last_attempt_at TEXT;
