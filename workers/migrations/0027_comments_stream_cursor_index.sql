-- Migration: 0027_comments_stream_cursor_index.sql
-- Description: Support cursor-based comment stream polling without full post scans

CREATE INDEX IF NOT EXISTS idx_comments_post_status_created_id
ON comments(post_id, status, created_at, id);
