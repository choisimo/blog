-- =============================================================================
-- Centralized Secrets Management
-- Migration: 0014_secrets_management.sql
-- =============================================================================

-- Secrets 카테고리
-- 키를 논리적으로 그룹화하여 관리
CREATE TABLE IF NOT EXISTS secret_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,              -- 'ai', 'auth', 'email', 'github', 'cloudflare'
  display_name TEXT NOT NULL,             -- 'AI Providers', 'Authentication'
  description TEXT,
  icon TEXT,                              -- 'bot', 'lock', 'mail', etc.
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Centralized Secrets Storage
-- 암호화된 시크릿 값 저장
CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  key_name TEXT NOT NULL UNIQUE,          -- 'OPENAI_API_KEY', 'JWT_SECRET'
  display_name TEXT NOT NULL,             -- 'OpenAI API Key'
  description TEXT,
  encrypted_value TEXT,                   -- AES-256-GCM 암호화된 값
  iv TEXT,                                -- Initialization Vector (Base64)
  is_required INTEGER DEFAULT 0,          -- 필수 여부
  is_sensitive INTEGER DEFAULT 1,         -- UI에서 마스킹 여부
  value_type TEXT DEFAULT 'string',       -- 'string', 'number', 'boolean', 'json', 'url'
  validation_pattern TEXT,                -- 정규식 검증 패턴
  default_value TEXT,                     -- 암호화되지 않은 기본값 (비민감 설정용)
  env_fallback TEXT,                      -- 환경변수 폴백 이름
  last_rotated_at TEXT,                   -- 마지막 키 교체 일시
  expires_at TEXT,                        -- 만료 일시 (선택)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,                        -- 생성자
  updated_by TEXT,                        -- 수정자
  FOREIGN KEY (category_id) REFERENCES secret_categories(id) ON DELETE RESTRICT
);

-- Secrets Audit Log
-- 시크릿 변경 이력 추적
CREATE TABLE IF NOT EXISTS secrets_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  secret_id TEXT NOT NULL,
  action TEXT NOT NULL,                   -- 'created', 'updated', 'deleted', 'rotated', 'accessed'
  old_value_hash TEXT,                    -- 이전 값의 SHA-256 해시 (값 자체 X)
  new_value_hash TEXT,                    -- 새 값의 SHA-256 해시
  changed_by TEXT,                        -- 변경자 (username or 'system')
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,                          -- JSON for additional context
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Secret References
-- 어떤 서비스/모듈이 어떤 시크릿을 사용하는지 추적
CREATE TABLE IF NOT EXISTS secret_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  secret_id TEXT NOT NULL,
  reference_type TEXT NOT NULL,           -- 'ai_provider', 'route', 'service', 'integration'
  reference_id TEXT NOT NULL,             -- 해당 타입의 ID
  reference_name TEXT,                    -- 읽기 쉬운 이름
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (secret_id) REFERENCES secrets(id) ON DELETE CASCADE,
  UNIQUE(secret_id, reference_type, reference_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_secrets_category ON secrets(category_id);
CREATE INDEX IF NOT EXISTS idx_secrets_key_name ON secrets(key_name);
CREATE INDEX IF NOT EXISTS idx_secrets_audit_secret ON secrets_audit_log(secret_id);
CREATE INDEX IF NOT EXISTS idx_secrets_audit_created ON secrets_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_secret_refs_secret ON secret_references(secret_id);
CREATE INDEX IF NOT EXISTS idx_secret_refs_type ON secret_references(reference_type, reference_id);

-- =============================================================================
-- Seed Data: Default Categories
-- =============================================================================

INSERT OR IGNORE INTO secret_categories (id, name, display_name, description, icon, sort_order) VALUES
  ('cat_ai', 'ai', 'AI Providers', 'API keys for AI service providers (OpenAI, Anthropic, Google, etc.)', 'bot', 1),
  ('cat_auth', 'auth', 'Authentication', 'JWT secrets, admin credentials, and auth tokens', 'lock', 2),
  ('cat_email', 'email', 'Email & Notifications', 'Email service API keys and notification settings', 'mail', 3),
  ('cat_github', 'github', 'GitHub Integration', 'GitHub tokens and repository access', 'github', 4),
  ('cat_cloudflare', 'cloudflare', 'Cloudflare', 'Cloudflare API tokens and configuration', 'cloud', 5),
  ('cat_database', 'database', 'Database', 'Database credentials and connection strings', 'database', 6),
  ('cat_general', 'general', 'General', 'Other configuration values and secrets', 'settings', 99);

-- =============================================================================
-- Update ai_providers to reference secrets table
-- =============================================================================

-- ai_providers.api_key_env를 secrets.key_name과 연결
-- 기존 api_key_env 컬럼은 유지하되, secret_id 컬럼 추가
ALTER TABLE ai_providers ADD COLUMN secret_id TEXT REFERENCES secrets(id) ON DELETE SET NULL;
