-- Private reader images. One row reserves exactly one image; never count requests as batches.
CREATE TABLE IF NOT EXISTS reader_image_jobs (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  network_key TEXT NOT NULL,
  day TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('reserved','complete','failed','unknown')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  result_json TEXT,
  object_deleted_at INTEGER,
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS reader_image_owner_day ON reader_image_jobs(owner, day, state);
CREATE INDEX IF NOT EXISTS reader_image_network_day ON reader_image_jobs(network_key, day, state);
CREATE INDEX IF NOT EXISTS reader_image_day_state ON reader_image_jobs(day, state);
CREATE INDEX IF NOT EXISTS reader_image_owner_created ON reader_image_jobs(owner, created_at);
CREATE INDEX IF NOT EXISTS reader_image_network_created ON reader_image_jobs(network_key, created_at);
CREATE INDEX IF NOT EXISTS reader_image_created ON reader_image_jobs(created_at);

CREATE TABLE IF NOT EXISTS reader_agent_preferences (
  owner TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  preferences_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
