-- Config management schema for web-based environment variable UI
-- Uses existing settings table pattern with enhanced structure

-- Config categories for grouping variables
CREATE TABLE IF NOT EXISTS config_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Config variables with type information and validation
CREATE TABLE IF NOT EXISTS config_variables (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  default_value TEXT,
  type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'number', 'boolean', 'select', 'password', 'url', 'textarea')),
  options TEXT, -- JSON array for select type
  is_secret INTEGER NOT NULL DEFAULT 0,
  is_required INTEGER NOT NULL DEFAULT 0,
  validation_regex TEXT,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(category_id) REFERENCES config_categories(id) ON DELETE CASCADE
);

-- Config change audit log
CREATE TABLE IF NOT EXISTS config_audit_log (
  id TEXT PRIMARY KEY,
  variable_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_config_variables_category ON config_variables(category_id);
CREATE INDEX IF NOT EXISTS idx_config_variables_key ON config_variables(key);
CREATE INDEX IF NOT EXISTS idx_config_audit_log_key ON config_audit_log(variable_key, changed_at DESC);

-- Seed default categories
INSERT OR IGNORE INTO config_categories (id, name, description, display_order) VALUES
  ('app', 'Application', '서버 기본 설정', 1),
  ('cors', 'CORS & URLs', 'CORS 허용 도메인 및 URL 설정', 2),
  ('ai', 'AI Services', 'AI 모델 및 VAS 서비스 설정', 3),
  ('assets', 'Assets', '정적 자산 URL 설정', 4),
  ('github', 'GitHub', 'GitHub 통합 설정', 5),
  ('rag', 'RAG Services', 'Embedding, ChromaDB 설정', 6),
  ('auth', 'Authentication', '인증 및 보안 설정', 7);

-- Seed default variables (without values - populated from current env)
INSERT OR IGNORE INTO config_variables (id, category_id, key, type, default_value, is_secret, description, display_order) VALUES
  -- App category
  ('v_app_env', 'app', 'APP_ENV', 'select', 'development', 0, '실행 환경', 1),
  ('v_host', 'app', 'HOST', 'text', '0.0.0.0', 0, '서버 호스트', 2),
  ('v_port', 'app', 'PORT', 'number', '5080', 0, '서버 포트', 3),
  ('v_log_level', 'app', 'LOG_LEVEL', 'select', 'info', 0, '로그 레벨', 4),
  ('v_trust_proxy', 'app', 'TRUST_PROXY', 'number', '1', 0, 'Proxy 신뢰 레벨', 5),
  
  -- CORS category
  ('v_allowed_origins', 'cors', 'ALLOWED_ORIGINS', 'textarea', 'http://localhost:5173', 0, 'CORS 허용 도메인 (쉼표 구분)', 1),
  ('v_api_base_url', 'cors', 'API_BASE_URL', 'url', 'http://localhost:5080', 0, 'API 기본 URL', 2),
  ('v_site_base_url', 'cors', 'SITE_BASE_URL', 'url', 'https://noblog.nodove.com', 0, '사이트 기본 URL', 3),
  
  -- Assets category
  ('v_assets_base_url', 'assets', 'ASSETS_BASE_URL', 'url', NULL, 0, 'Assets Base URL', 1),
  
  -- AI category
  ('v_ai_serve_base_url', 'ai', 'AI_SERVE_BASE_URL', 'url', 'http://vas-proxy:7016', 0, 'VAS Proxy URL', 1),
  ('v_vas_core_url', 'ai', 'VAS_CORE_URL', 'url', 'http://vas-core:7012', 0, 'VAS Core URL', 2),
  ('v_ai_default_provider', 'ai', 'AI_SERVE_DEFAULT_PROVIDER', 'select', 'github-copilot', 0, '기본 AI 제공자', 3),
  ('v_ai_default_model', 'ai', 'AI_SERVE_DEFAULT_MODEL', 'text', 'gpt-4.1', 0, '기본 AI 모델', 4),
  ('v_gemini_api_key', 'ai', 'GEMINI_API_KEY', 'password', NULL, 1, 'Gemini API Key', 5),
  ('v_openrouter_api_key', 'ai', 'OPENROUTER_API_KEY', 'password', NULL, 1, 'OpenRouter API Key', 6),
  
  -- GitHub category
  ('v_github_token', 'github', 'GITHUB_TOKEN', 'password', NULL, 1, 'GitHub Personal Access Token', 1),
  ('v_github_owner', 'github', 'GITHUB_REPO_OWNER', 'text', NULL, 0, 'GitHub Repo Owner', 2),
  ('v_github_repo', 'github', 'GITHUB_REPO_NAME', 'text', NULL, 0, 'GitHub Repo Name', 3),
  ('v_git_user_name', 'github', 'GIT_USER_NAME', 'text', NULL, 0, 'Git User Name', 4),
  ('v_git_user_email', 'github', 'GIT_USER_EMAIL', 'text', NULL, 0, 'Git User Email', 5),
  
  -- RAG category
  ('v_ai_embedding_url', 'rag', 'AI_EMBEDDING_URL', 'url', 'https://api.openai.com/v1', 0, 'Embedding Endpoint URL', 1),
  ('v_ai_embedding_api_key', 'rag', 'AI_EMBEDDING_API_KEY', 'password', NULL, 1, 'Embedding API Key', 2),
  ('v_ai_embed_model', 'rag', 'AI_EMBED_MODEL', 'text', 'text-embedding-3-small', 0, 'Embedding Model', 3),
  ('v_chroma_url', 'rag', 'CHROMA_URL', 'url', 'http://chromadb:8000', 0, 'ChromaDB URL', 4),
  ('v_chroma_collection', 'rag', 'CHROMA_COLLECTION', 'text', 'blog-posts-all-MiniLM-L6-v2', 0, 'ChromaDB Collection', 5),
  
  -- Auth category
  ('v_admin_bearer_token', 'auth', 'ADMIN_BEARER_TOKEN', 'password', NULL, 1, 'Admin Bearer Token', 1),
  ('v_jwt_secret', 'auth', 'JWT_SECRET', 'password', NULL, 1, 'JWT Secret', 2),
  ('v_admin_username', 'auth', 'ADMIN_USERNAME', 'text', NULL, 0, 'Admin Username', 3),
  ('v_admin_password', 'auth', 'ADMIN_PASSWORD', 'password', NULL, 1, 'Admin Password', 4);

-- Update options for select types
UPDATE config_variables SET options = '["development","staging","production","test"]' WHERE key = 'APP_ENV';
UPDATE config_variables SET options = '["fatal","error","warn","info","debug","trace"]' WHERE key = 'LOG_LEVEL';
UPDATE config_variables SET options = '["github-copilot","gemini","openai","anthropic","local"]' WHERE key = 'AI_SERVE_DEFAULT_PROVIDER';
