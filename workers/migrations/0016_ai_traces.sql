-- AI Distributed Tracing System
-- Migration: 0016_ai_traces.sql

CREATE TABLE IF NOT EXISTS ai_traces (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  span_type TEXT NOT NULL,
  start_time_ms INTEGER NOT NULL,
  end_time_ms INTEGER,
  latency_ms INTEGER,
  status TEXT DEFAULT 'pending',
  model_id TEXT,
  provider_id TEXT,
  route_id TEXT,
  user_id TEXT,
  request_path TEXT,
  request_method TEXT,
  response_status INTEGER,
  error_message TEXT,
  tokens_used INTEGER,
  estimated_cost REAL,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES ai_models(id) ON DELETE SET NULL,
  FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE SET NULL,
  FOREIGN KEY (route_id) REFERENCES ai_routes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_traces_trace_id ON ai_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_ai_traces_created_at ON ai_traces(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_traces_status ON ai_traces(status);
CREATE INDEX IF NOT EXISTS idx_ai_traces_span_type ON ai_traces(span_type);
CREATE INDEX IF NOT EXISTS idx_ai_traces_model_id ON ai_traces(model_id);

CREATE TABLE IF NOT EXISTS ai_trace_summary (
  trace_id TEXT PRIMARY KEY,
  total_spans INTEGER DEFAULT 0,
  total_latency_ms INTEGER,
  status TEXT DEFAULT 'pending',
  root_span_type TEXT,
  model_id TEXT,
  provider_id TEXT,
  user_id TEXT,
  request_path TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_trace_summary_created ON ai_trace_summary(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_trace_summary_status ON ai_trace_summary(status);
