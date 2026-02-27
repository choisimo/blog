-- Migration: 0009_user_memories.sql
-- Purpose: User memory storage for AI chatbot context + chat session persistence

-- ========================================
-- User Memories Table
-- Stores extracted facts, preferences, and context from conversations
-- ========================================
CREATE TABLE IF NOT EXISTS user_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  memory_type TEXT NOT NULL DEFAULT 'fact',  -- 'fact', 'preference', 'context', 'summary'
  category TEXT,  -- 'personal', 'technical', 'interest', 'goal', etc.
  content TEXT NOT NULL,
  source_type TEXT,  -- 'chat', 'memo', 'manual'
  source_id TEXT,  -- reference to chat_sessions.id or memos.id
  importance_score REAL DEFAULT 0.5,  -- 0.0 ~ 1.0, for retrieval ranking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TEXT,
  expires_at TEXT,  -- optional TTL for temporary memories
  is_active INTEGER DEFAULT 1,  -- soft delete flag
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_type ON user_memories(user_id, memory_type, is_active);
CREATE INDEX IF NOT EXISTS idx_user_memories_category ON user_memories(user_id, category, is_active);
CREATE INDEX IF NOT EXISTS idx_user_memories_importance ON user_memories(user_id, importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_source ON user_memories(source_type, source_id);

-- ========================================
-- Chat Sessions Table
-- Stores persistent chat sessions for logged-in users
-- ========================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  title TEXT,  -- auto-generated or user-defined
  summary TEXT,  -- AI-generated summary of the conversation
  question_mode TEXT DEFAULT 'general',  -- 'general', 'article'
  article_slug TEXT,  -- if question_mode is 'article'
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id, is_deleted, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_article ON chat_sessions(article_slug, is_deleted);

-- ========================================
-- Chat Messages Table
-- Stores individual messages in chat sessions
-- ========================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  role TEXT NOT NULL,  -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',  -- 'text', 'image', 'code', 'error'
  metadata TEXT,  -- JSON: { sources, followups, images, tokens, etc. }
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, created_at DESC);

-- ========================================
-- Memory Embeddings Table (optional, for local vector search)
-- Stores pre-computed embeddings for faster similarity search
-- ========================================
CREATE TABLE IF NOT EXISTS memory_embeddings (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL UNIQUE,
  embedding_model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  embedding_dim INTEGER NOT NULL DEFAULT 384,
  embedding_blob BLOB,  -- serialized float32 array
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (memory_id) REFERENCES user_memories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_embeddings_memory ON memory_embeddings(memory_id);
