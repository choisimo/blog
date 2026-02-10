-- User content tables: Personas and Memos
-- Stores user-created personas for AI interactions and saved memos

-- Personas table
CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  tags TEXT, -- JSON array of tags
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Memos table
CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  original_content TEXT NOT NULL,
  user_note TEXT,
  tags TEXT, -- JSON array of tags
  source TEXT, -- JSON object with url, title, postId, etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_user_id ON memos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_created_at ON memos(created_at DESC);
