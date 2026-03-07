-- Migration: 0022_advanced_fingerprints.sql
-- Purpose: Add structured hardware-level fingerprint component columns
--          to support hybrid identification and fuzzy matching.

-- Component hash columns for individual fingerprint signals
ALTER TABLE user_fingerprints ADD COLUMN canvas_hash TEXT;

ALTER TABLE user_fingerprints ADD COLUMN webgl_hash TEXT;

ALTER TABLE user_fingerprints ADD COLUMN audio_hash TEXT;

ALTER TABLE user_fingerprints ADD COLUMN screen_resolution TEXT;

ALTER TABLE user_fingerprints ADD COLUMN os_version TEXT;

ALTER TABLE user_fingerprints
ADD COLUMN advanced_fingerprint_hash TEXT;

-- Indexes for fuzzy matching lookups
CREATE INDEX IF NOT EXISTS idx_uf_canvas ON user_fingerprints (canvas_hash);

CREATE INDEX IF NOT EXISTS idx_uf_webgl ON user_fingerprints (webgl_hash);

CREATE INDEX IF NOT EXISTS idx_uf_audio ON user_fingerprints (audio_hash);

CREATE INDEX IF NOT EXISTS idx_uf_advanced ON user_fingerprints (advanced_fingerprint_hash);

-- Add device_fingerprint column to comments table for spam prevention
ALTER TABLE comments ADD COLUMN device_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_comments_device_fp ON comments (
    device_fingerprint,
    created_at
);