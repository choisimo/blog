-- Migration: 0029_translation_job_leases
-- Description: Add durable lease ownership to translation jobs for cross-isolate single-flight.

ALTER TABLE translation_jobs ADD COLUMN lock_token TEXT;
ALTER TABLE translation_jobs ADD COLUMN lock_expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_translation_jobs_running_lease
ON translation_jobs(year, slug, target_lang, content_hash, status, lock_expires_at);
