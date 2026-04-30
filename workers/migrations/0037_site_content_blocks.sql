-- Managed public content blocks for homepage and editorial UI surfaces.

CREATE TABLE IF NOT EXISTS site_content_blocks (
  key TEXT PRIMARY KEY,
  markdown TEXT NOT NULL,
  cta_label TEXT,
  cta_href TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  changed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_site_content_blocks_enabled ON site_content_blocks(enabled);

INSERT OR IGNORE INTO site_content_blocks (
  key,
  markdown,
  cta_label,
  cta_href,
  enabled,
  changed_by
) VALUES (
  'home_ai_cta',
  '### AI Chat & Writing Assistant

아이디어를 정리하고, 글을 작성하고, 코드 설계를 함께 다듬어보세요.',
  'AI 도구 열기',
  '/?ai=chat',
  1,
  'system'
);
