-- Comment reactions/stickers table
-- Allows users to react to comments with emoji stickers

CREATE TABLE IF NOT EXISTS comment_reactions (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  user_fingerprint TEXT NOT NULL, -- Browser fingerprint for anonymous reaction tracking
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Ensure one reaction type per user per comment
CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_reactions_unique 
  ON comment_reactions(comment_id, emoji, user_fingerprint);

-- Index for fast reaction counts per comment
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment 
  ON comment_reactions(comment_id);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_comment_reactions_created 
  ON comment_reactions(created_at);
