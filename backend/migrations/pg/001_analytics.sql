CREATE TABLE IF NOT EXISTS post_visits (
  id BIGSERIAL PRIMARY KEY,
  post_slug TEXT NOT NULL,
  year TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  city TEXT,
  path TEXT,
  session_id TEXT,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_visits_slug_year ON post_visits (post_slug, year);
CREATE INDEX IF NOT EXISTS idx_post_visits_visited_at ON post_visits (visited_at DESC);

CREATE TABLE IF NOT EXISTS server_logs (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL,
  service TEXT,
  message TEXT NOT NULL,
  context JSONB,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_server_logs_logged_at ON server_logs (logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_logs_level ON server_logs (level);
CREATE INDEX IF NOT EXISTS idx_server_logs_service ON server_logs (service);

CREATE TABLE IF NOT EXISTS post_stats_pg (
  post_slug TEXT NOT NULL,
  year TEXT NOT NULL,
  total_views BIGINT NOT NULL DEFAULT 0,
  views_7d INT NOT NULL DEFAULT 0,
  views_30d INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_slug, year)
);
