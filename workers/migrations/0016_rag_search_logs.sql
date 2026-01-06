-- Migration: RAG Search Logs & RRF Scoring
-- Purpose: Store hybrid search results with RRF (Reciprocal Rank Fusion) weights
-- for intent reinforcement and search quality analysis

-- ============================================================================
-- RAG Search Sessions Table
-- ============================================================================
-- Tracks each search session and its configuration
CREATE TABLE IF NOT EXISTS rag_search_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,                          -- Optional user ID for personalization
    session_type TEXT DEFAULT 'chat',      -- 'chat', 'search', 'recommendation'
    query_text TEXT NOT NULL,              -- Original query
    query_embedding_hash TEXT,             -- Hash of embedding for deduplication
    
    -- Search configuration
    semantic_weight REAL DEFAULT 0.6,      -- Weight for semantic search (0-1)
    keyword_weight REAL DEFAULT 0.4,       -- Weight for keyword search (0-1)
    rrf_k INTEGER DEFAULT 60,              -- RRF constant (typically 60)
    
    -- Results metadata
    total_results INTEGER DEFAULT 0,
    semantic_results_count INTEGER DEFAULT 0,
    keyword_results_count INTEGER DEFAULT 0,
    
    -- Timing
    semantic_latency_ms INTEGER,
    keyword_latency_ms INTEGER,
    total_latency_ms INTEGER,
    
    -- Status
    status TEXT DEFAULT 'success',         -- 'success', 'partial', 'failed'
    error_message TEXT,
    
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- RAG Search Results Table
-- ============================================================================
-- Individual results from each search with scoring breakdown
CREATE TABLE IF NOT EXISTS rag_search_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES rag_search_sessions(id) ON DELETE CASCADE,
    
    -- Document identification
    document_id TEXT NOT NULL,             -- Post slug or document ID
    document_type TEXT DEFAULT 'post',     -- 'post', 'memory', 'document'
    
    -- Scoring components
    semantic_rank INTEGER,                 -- Rank from semantic search (1-based)
    semantic_score REAL,                   -- Raw semantic similarity score
    keyword_rank INTEGER,                  -- Rank from keyword search (1-based)
    keyword_score REAL,                    -- BM25 or keyword match score
    
    -- RRF combined score
    rrf_score REAL NOT NULL,               -- Final RRF combined score
    final_rank INTEGER NOT NULL,           -- Final rank after RRF fusion
    
    -- Document metadata snapshot
    title TEXT,
    category TEXT,
    tags TEXT,                             -- JSON array of tags
    snippet TEXT,                          -- Matched content snippet
    
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- RAG Query Intent Cache
-- ============================================================================
-- Cache learned intent patterns for faster future queries
CREATE TABLE IF NOT EXISTS rag_query_intents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_pattern TEXT NOT NULL,           -- Normalized query pattern
    query_hash TEXT UNIQUE NOT NULL,       -- Hash for fast lookup
    
    -- Learned optimal weights from user feedback
    optimal_semantic_weight REAL,
    optimal_keyword_weight REAL,
    optimal_rrf_k INTEGER,
    
    -- Intent classification
    intent_type TEXT,                      -- 'informational', 'navigational', 'transactional'
    intent_confidence REAL,
    
    -- Usage statistics
    hit_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    
    -- Feedback aggregates
    positive_feedback INTEGER DEFAULT 0,
    negative_feedback INTEGER DEFAULT 0,
    avg_relevance_score REAL,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- RAG Feedback Table
-- ============================================================================
-- User feedback on search results for continuous improvement
CREATE TABLE IF NOT EXISTS rag_search_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES rag_search_sessions(id) ON DELETE CASCADE,
    result_id INTEGER REFERENCES rag_search_results(id) ON DELETE CASCADE,
    
    user_id TEXT,
    feedback_type TEXT NOT NULL,           -- 'click', 'like', 'dislike', 'report'
    feedback_value INTEGER,                -- 1 for positive, -1 for negative, etc.
    
    -- Context
    position_clicked INTEGER,              -- Which position was clicked
    time_to_click_ms INTEGER,              -- Time from results shown to click
    
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_rag_sessions_user ON rag_search_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_sessions_created ON rag_search_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_sessions_type ON rag_search_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_rag_sessions_query_hash ON rag_search_sessions(query_embedding_hash);

CREATE INDEX IF NOT EXISTS idx_rag_results_session ON rag_search_results(session_id);
CREATE INDEX IF NOT EXISTS idx_rag_results_document ON rag_search_results(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_results_final_rank ON rag_search_results(session_id, final_rank);

CREATE INDEX IF NOT EXISTS idx_rag_intents_hash ON rag_query_intents(query_hash);
CREATE INDEX IF NOT EXISTS idx_rag_intents_pattern ON rag_query_intents(query_pattern);

CREATE INDEX IF NOT EXISTS idx_rag_feedback_session ON rag_search_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_rag_feedback_user ON rag_search_feedback(user_id);
