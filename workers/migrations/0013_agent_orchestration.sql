-- Migration: 0013_agent_orchestration.sql
-- Purpose: Agent orchestration layer tables for multi-turn conversations,
--          tool execution history, and enhanced memory management

-- ========================================
-- Agent Sessions Table
-- Stores agent conversation sessions with tool execution context
-- ========================================
CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  title TEXT,                           -- Auto-generated or user-defined title
  mode TEXT DEFAULT 'default',          -- Agent mode: default, research, coding, blog, article, terminal
  article_slug TEXT,                    -- If mode is 'article'
  system_prompt_hash TEXT,              -- Hash of system prompt for cache invalidation
  message_count INTEGER DEFAULT 0,
  tool_call_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  last_model TEXT,                      -- Last model used
  status TEXT DEFAULT 'active',         -- active, archived, deleted
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON agent_sessions(user_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_mode ON agent_sessions(user_id, mode, status);

-- ========================================
-- Agent Messages Table
-- Stores individual messages in agent sessions
-- ========================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  role TEXT NOT NULL,                   -- 'user', 'assistant', 'system', 'tool'
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',     -- 'text', 'tool_call', 'tool_result', 'error'
  
  -- Tool call specific fields
  tool_name TEXT,                       -- Name of tool called (if role='tool')
  tool_call_id TEXT,                    -- Unique ID for tool call
  tool_args TEXT,                       -- JSON: Tool arguments
  tool_result TEXT,                     -- JSON: Tool execution result
  tool_duration_ms INTEGER,             -- Tool execution time
  
  -- Token tracking
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  
  -- Metadata
  model TEXT,                           -- Model used for this message
  metadata TEXT,                        -- JSON: Additional metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_tool ON agent_messages(session_id, role, tool_name);

-- ========================================
-- Agent Tool Executions Table
-- Detailed log of all tool executions for debugging and analytics
-- ========================================
CREATE TABLE IF NOT EXISTS agent_tool_executions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  tool_name TEXT NOT NULL,
  tool_version TEXT,
  
  -- Execution details
  input_args TEXT NOT NULL,             -- JSON: Input arguments
  output_result TEXT,                   -- JSON: Output result
  error_message TEXT,                   -- Error message if failed
  status TEXT NOT NULL,                 -- 'pending', 'running', 'success', 'error', 'timeout'
  
  -- Timing
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  duration_ms INTEGER,
  
  -- Context
  retry_count INTEGER DEFAULT 0,
  parent_execution_id TEXT,             -- For nested tool calls
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_tool_executions_session ON agent_tool_executions(session_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tool_executions_tool ON agent_tool_executions(tool_name, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tool_executions_user ON agent_tool_executions(user_id, started_at DESC);

-- ========================================
-- Agent User Preferences Table
-- Stores user-specific agent configuration
-- ========================================
CREATE TABLE IF NOT EXISTS agent_user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  
  -- Default settings
  default_mode TEXT DEFAULT 'default',
  default_model TEXT,
  default_temperature REAL DEFAULT 0.7,
  
  -- Tool preferences
  enabled_tools TEXT,                   -- JSON: Array of enabled tool names
  disabled_tools TEXT,                  -- JSON: Array of disabled tool names
  
  -- Memory preferences
  memory_enabled INTEGER DEFAULT 1,
  memory_retention_days INTEGER DEFAULT 90,
  auto_summarize INTEGER DEFAULT 1,
  
  -- UI preferences
  stream_responses INTEGER DEFAULT 1,
  show_tool_calls INTEGER DEFAULT 1,
  
  -- Custom instructions
  custom_instructions TEXT,
  persona TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_user_preferences_user ON agent_user_preferences(user_id);

-- ========================================
-- Agent Knowledge Base Table
-- Stores indexed knowledge for RAG retrieval
-- ========================================
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'system',
  source_type TEXT NOT NULL,            -- 'blog_post', 'memo', 'manual', 'web', 'file'
  source_id TEXT,                       -- Reference to source (e.g., post slug, memo id)
  source_url TEXT,
  
  -- Content
  title TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,           -- For deduplication
  
  -- Chunking info
  chunk_index INTEGER DEFAULT 0,        -- For multi-chunk documents
  total_chunks INTEGER DEFAULT 1,
  
  -- Metadata
  category TEXT,
  tags TEXT,                            -- JSON: Array of tags
  language TEXT DEFAULT 'ko',
  
  -- Embedding status
  embedding_status TEXT DEFAULT 'pending',  -- 'pending', 'indexed', 'failed'
  embedding_model TEXT,
  last_indexed_at TEXT,
  
  -- Visibility
  is_public INTEGER DEFAULT 1,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_source ON agent_knowledge(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_user ON agent_knowledge(user_id, is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_embedding ON agent_knowledge(embedding_status, updated_at);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_hash ON agent_knowledge(content_hash);

-- ========================================
-- Agent Feedback Table
-- Stores user feedback on agent responses for improvement
-- ========================================
CREATE TABLE IF NOT EXISTS agent_feedback (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'default-user',
  
  -- Feedback
  rating INTEGER,                       -- 1-5 star rating
  feedback_type TEXT,                   -- 'helpful', 'not_helpful', 'incorrect', 'offensive'
  comment TEXT,
  
  -- Context
  query TEXT,                           -- Original user query
  response TEXT,                        -- Agent response
  tools_used TEXT,                      -- JSON: Tools used in response
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_session ON agent_feedback(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_rating ON agent_feedback(rating, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_type ON agent_feedback(feedback_type, created_at DESC);

-- ========================================
-- Views for Analytics
-- ========================================

-- Daily agent usage summary
CREATE VIEW IF NOT EXISTS v_agent_daily_usage AS
SELECT 
  date(created_at) as date,
  user_id,
  COUNT(DISTINCT id) as session_count,
  SUM(message_count) as total_messages,
  SUM(tool_call_count) as total_tool_calls,
  SUM(total_tokens) as total_tokens,
  SUM(total_cost) as total_cost
FROM agent_sessions
WHERE status != 'deleted'
GROUP BY date(created_at), user_id;

-- Tool usage summary
CREATE VIEW IF NOT EXISTS v_agent_tool_usage AS
SELECT 
  tool_name,
  COUNT(*) as execution_count,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms
FROM agent_tool_executions
GROUP BY tool_name;
