-- Seed initial admin user
-- Note: Password hash should be updated with actual bcrypt/argon2 hash in production
-- This is just a placeholder for the migration structure

-- INSERT INTO users(id, username, password_hash, created_at, updated_at)
-- VALUES (
--   'admin-' || lower(hex(randomblob(8))),
--   'admin',
--   '$2a$10$placeholder.hash.will.be.replaced',
--   datetime('now'),
--   datetime('now')
-- );

-- To be populated via admin setup script or manual insert
