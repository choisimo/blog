-- Store only a one-way digest of user session bearer tokens.
-- The legacy session_token column remains populated with a non-secret marker to
-- preserve existing NOT NULL/UNIQUE constraints and compatibility with older rows.
ALTER TABLE user_sessions ADD COLUMN session_token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash_active ON user_sessions(session_token_hash, is_active);
