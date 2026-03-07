-- Memo versioning for history/restore functionality
-- Stores versions of memo content for undo/restore capabilities

-- Main memo content table (updated to track current version)
-- The existing 'memos' table stores individual clips/selections
-- This new table stores the full memo editor content with versioning
CREATE TABLE IF NOT EXISTS memo_content (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Memo version history table
CREATE TABLE IF NOT EXISTS memo_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memo_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_length INTEGER NOT NULL DEFAULT 0,
  change_summary TEXT, -- Brief description of what changed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (memo_id) REFERENCES memo_content(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_memo_content_user_id ON memo_content(user_id);
CREATE INDEX IF NOT EXISTS idx_memo_versions_memo_id ON memo_versions(memo_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_memo_versions_user_id ON memo_versions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memo_versions_created_at ON memo_versions(created_at DESC);
