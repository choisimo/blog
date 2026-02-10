-- Post analytics and editor picks tables
-- Tracks view counts and manages automatically curated editor picks

-- Post views tracking table
CREATE TABLE IF NOT EXISTS post_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_slug TEXT NOT NULL,
  year TEXT NOT NULL,
  view_date TEXT NOT NULL DEFAULT (date('now')),
  view_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_slug, year, view_date)
);

-- Aggregated post stats for quick lookups
CREATE TABLE IF NOT EXISTS post_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_slug TEXT NOT NULL,
  year TEXT NOT NULL,
  total_views INTEGER NOT NULL DEFAULT 0,
  views_7d INTEGER NOT NULL DEFAULT 0,
  views_30d INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_slug, year)
);

-- Editor picks table (auto-updated daily)
CREATE TABLE IF NOT EXISTS editor_picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_slug TEXT NOT NULL,
  year TEXT NOT NULL,
  title TEXT NOT NULL,
  cover_image TEXT,
  category TEXT,
  rank INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0,
  reason TEXT,
  picked_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_slug, year)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_views_slug_year ON post_views(post_slug, year);
CREATE INDEX IF NOT EXISTS idx_post_views_date ON post_views(view_date DESC);
CREATE INDEX IF NOT EXISTS idx_post_stats_slug_year ON post_stats(post_slug, year);
CREATE INDEX IF NOT EXISTS idx_post_stats_total_views ON post_stats(total_views DESC);
CREATE INDEX IF NOT EXISTS idx_post_stats_views_7d ON post_stats(views_7d DESC);
CREATE INDEX IF NOT EXISTS idx_editor_picks_active ON editor_picks(is_active, rank);
CREATE INDEX IF NOT EXISTS idx_editor_picks_expires ON editor_picks(expires_at);
