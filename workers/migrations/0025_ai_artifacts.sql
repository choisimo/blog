-- Migration: 0025_ai_artifacts
-- Description: Feed artifact snapshots, read-state, scheduler bookkeeping

CREATE TABLE IF NOT EXISTS ai_artifact_versions (
  id TEXT PRIMARY KEY,
  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN (
      'feed.lens',
      'feed.thought',
      'card.sketch',
      'card.prism',
      'card.chain',
      'card.summary'
    )
  ),
  scope_key TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1',
  model_route TEXT,
  generation_version_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('warming', 'ready', 'stale', 'superseded', 'failed')
  ),
  active INTEGER NOT NULL DEFAULT 0,
  latest_page INTEGER NOT NULL DEFAULT -1,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  ready_at TEXT,
  UNIQUE (artifact_type, scope_key, generation_version_hash)
);

CREATE INDEX IF NOT EXISTS idx_ai_artifact_versions_lookup
ON ai_artifact_versions (artifact_type, scope_key, active, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_artifact_versions_status
ON ai_artifact_versions (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_artifact_pages (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  page_no INTEGER NOT NULL,
  logical_keys_json TEXT NOT NULL,
  item_hashes_json TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  exhausted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (version_id) REFERENCES ai_artifact_versions(id) ON DELETE CASCADE,
  UNIQUE (version_id, page_no)
);

CREATE INDEX IF NOT EXISTS idx_ai_artifact_pages_version
ON ai_artifact_pages (version_id, page_no);

CREATE TABLE IF NOT EXISTS user_ai_artifact_read_state (
  id TEXT PRIMARY KEY,
  user_key TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN (
      'feed.lens',
      'feed.thought',
      'card.sketch',
      'card.prism',
      'card.chain',
      'card.summary'
    )
  ),
  scope_key TEXT NOT NULL,
  logical_key TEXT NOT NULL,
  item_hash TEXT NOT NULL,
  first_read_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_key, artifact_type, scope_key, logical_key)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_artifact_read_state_lookup
ON user_ai_artifact_read_state (user_key, artifact_type, scope_key);

CREATE TABLE IF NOT EXISTS ai_warm_candidates (
  id TEXT PRIMARY KEY,
  artifact_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  target_lang TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL CHECK (
    priority IN ('interactive', 'publish', 'revisit', 'hot', 'idle')
  ),
  candidate_score REAL NOT NULL DEFAULT 0,
  target_pages INTEGER NOT NULL DEFAULT 1,
  next_run_at TEXT NOT NULL,
  last_enqueued_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  fail_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'paused')
  ),
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (artifact_type, scope_key, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_ai_warm_candidates_schedule
ON ai_warm_candidates (status, priority, next_run_at, candidate_score DESC);

CREATE INDEX IF NOT EXISTS idx_ai_warm_candidates_lookup
ON ai_warm_candidates (artifact_type, scope_key, target_lang);

CREATE TABLE IF NOT EXISTS ai_scheduler_decisions (
  id TEXT PRIMARY KEY,
  scheduler_id TEXT NOT NULL,
  redis_up INTEGER NOT NULL,
  queue_enabled INTEGER NOT NULL,
  queue_length INTEGER NOT NULL,
  dlq_length INTEGER NOT NULL,
  allow_warm INTEGER NOT NULL,
  decision_reason TEXT,
  snapshot_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_scheduler_decisions_created
ON ai_scheduler_decisions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_translations_cache_lookup
ON post_translations_cache (year, post_slug, target_lang);
