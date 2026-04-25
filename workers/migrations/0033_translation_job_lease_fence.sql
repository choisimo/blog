-- Migration: 0033_translation_job_lease_fence
-- Description: Add a monotonically increasing fencing version to translation job leases.

ALTER TABLE translation_jobs ADD COLUMN lease_version INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_translation_jobs_lease_fence
ON translation_jobs(id, lock_token, lease_version);
