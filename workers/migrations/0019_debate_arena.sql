-- Migration: 0019_debate_arena.sql
-- Purpose: Multi-agent AI debate system with orchestration

CREATE TABLE IF NOT EXISTS debate_topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  context TEXT,
  category TEXT,
  difficulty TEXT DEFAULT 'medium',
  created_by TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_debate_topics_active ON debate_topics(is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS debate_sessions (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  user_id TEXT,
  fingerprint_id TEXT,
  status TEXT DEFAULT 'active',
  winner_agent TEXT,
  total_rounds INTEGER DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (topic_id) REFERENCES debate_topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_debate_sessions_topic ON debate_sessions(topic_id, status);
CREATE INDEX IF NOT EXISTS idx_debate_sessions_user ON debate_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS debate_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_role TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  content TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  response_time_ms INTEGER,
  tokens_used INTEGER,
  confidence_score REAL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES debate_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_debate_messages_session ON debate_messages(session_id, round_number, created_at);

CREATE TABLE IF NOT EXISTS debate_votes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  user_id TEXT,
  fingerprint_id TEXT,
  voted_for TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, round_number, fingerprint_id),
  FOREIGN KEY (session_id) REFERENCES debate_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_debate_votes_session ON debate_votes(session_id, round_number);
