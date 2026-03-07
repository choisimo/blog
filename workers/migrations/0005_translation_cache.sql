-- AI Translation cache table
-- Stores cached translations to avoid repeated API calls

CREATE TABLE IF NOT EXISTS post_translations_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_slug TEXT NOT NULL,
  year TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  is_ai_generated INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_slug, year, target_lang)
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_translations_cache_lookup 
  ON post_translations_cache(post_slug, year, target_lang);
CREATE INDEX IF NOT EXISTS idx_translations_cache_hash 
  ON post_translations_cache(content_hash);
