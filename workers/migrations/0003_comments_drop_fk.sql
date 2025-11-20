-- Drop foreign key on comments.post_id by recreating table without FK
-- This migration preserves data and indexes

PRAGMA foreign_keys = OFF;

-- Create new table without FK constraint
CREATE TABLE IF NOT EXISTS comments_new (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author TEXT NOT NULL,
  email TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible', 'hidden', 'pending')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy data from old table
INSERT INTO comments_new (id, post_id, author, email, content, status, created_at, updated_at)
SELECT id, post_id, author, email, content, status, created_at, updated_at FROM comments;

-- Replace old table
DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);

PRAGMA foreign_keys = ON;
