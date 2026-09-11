-- Stop old translation consumers before applying; old binaries must not write this schema.
-- Keep all prior jobs and caches. Legacy in-flight work has an unknown outcome and is not retried.
CREATE TABLE translation_jobs_a02 (
  id TEXT PRIMARY KEY, key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','deferred','running','succeeded','failed')),
  year TEXT NOT NULL, slug TEXT NOT NULL, target_lang TEXT NOT NULL, source_lang TEXT,
  force_refresh INTEGER NOT NULL DEFAULT 0, content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, started_at TEXT NOT NULL,
  completed_at TEXT, status_url TEXT NOT NULL, cache_url TEXT NOT NULL, generate_url TEXT NOT NULL,
  error_json TEXT, result_json TEXT, lock_token TEXT, lock_expires_at TEXT,
  lease_version INTEGER NOT NULL DEFAULT 0,
  source_version TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 100,
  attempts INTEGER NOT NULL DEFAULT 0, available_at TEXT NOT NULL,
  outbox_id TEXT, active_stage TEXT, checkpoint_json TEXT NOT NULL DEFAULT '{}',
  token_budget INTEGER NOT NULL DEFAULT 0, requested_by TEXT,
  refresh_key TEXT, last_wake_at TEXT,
  UNIQUE(year, slug, target_lang, content_hash)
);
INSERT INTO translation_jobs_a02 (
  id,key,status,year,slug,target_lang,source_lang,force_refresh,content_hash,
  created_at,updated_at,started_at,completed_at,status_url,cache_url,generate_url,
  error_json,result_json,lock_token,lock_expires_at,lease_version,source_version,available_at
)
SELECT id,key,CASE WHEN status='running' THEN 'failed' ELSE status END,
  year,slug,target_lang,source_lang,force_refresh,content_hash,
  created_at,updated_at,started_at,completed_at,status_url,cache_url,generate_url,
  CASE WHEN status='running' THEN '{"code":"RESULT_UNKNOWN","message":"Previous execution outcome needs review","retryable":false}' ELSE error_json END,
  result_json,NULL,NULL,lease_version+1,'legacy:'||content_hash,updated_at
FROM translation_jobs;
DROP TABLE translation_jobs;
ALTER TABLE translation_jobs_a02 RENAME TO translation_jobs;
CREATE INDEX idx_translation_jobs_lookup ON translation_jobs(year,slug,target_lang,source_version);
CREATE INDEX idx_translation_jobs_pending ON translation_jobs(status,available_at,priority,created_at);
CREATE INDEX idx_translation_jobs_lease ON translation_jobs(id,lock_token,lease_version);
CREATE UNIQUE INDEX idx_translation_jobs_outbox ON translation_jobs(outbox_id) WHERE outbox_id IS NOT NULL;
ALTER TABLE post_translations_cache ADD COLUMN source_version TEXT;
CREATE TABLE translation_attempts (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL, day TEXT NOT NULL,
  token_budget INTEGER NOT NULL CHECK(token_budget>=0), created_at TEXT NOT NULL
);
CREATE INDEX idx_translation_attempts_day ON translation_attempts(day,job_id);
