-- Migration: 0026_translation_jobs
-- Description: Create durable translation job storage

CREATE TABLE IF NOT EXISTS translation_jobs (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  year TEXT NOT NULL,
  slug TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_lang TEXT,
  force_refresh INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status_url TEXT NOT NULL,
  cache_url TEXT NOT NULL,
  generate_url TEXT NOT NULL,
  error_json TEXT,
  result_json TEXT,
  UNIQUE(year, slug, target_lang, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_translation_jobs_lookup
ON translation_jobs(year, slug, target_lang, content_hash);

CREATE INDEX IF NOT EXISTS idx_translation_jobs_id
ON translation_jobs(id);
