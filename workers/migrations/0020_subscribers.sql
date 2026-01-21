-- Migration: 0020_subscribers
-- Description: Create subscribers table for newsletter functionality

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'unsubscribed')),
  confirm_token TEXT,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);

-- Index for status filtering (e.g., get all confirmed subscribers)
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);

-- Index for confirm token lookup
CREATE INDEX IF NOT EXISTS idx_subscribers_confirm_token ON subscribers(confirm_token);
