// Cloudflare Workers Environment Bindings
export type Env = {
  // Bindings
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;

  // Secrets
  JWT_SECRET: string;
  TAVILY_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_EMAIL?: string; // Admin email for OTP verification (GitHub Secrets)

  // Backend Proxy Configuration
  BACKEND_ORIGIN?: string; // e.g., http://YOUR_SERVER_IP:8080
  BACKEND_SECRET_KEY?: string; // Shared secret for backend authentication

  // Backend AI Server (via Cloudflare Tunnel)
  // 모든 AI 호출은 이 서버를 통해 처리됩니다
  AI_SERVE_BASE_URL?: string; // e.g., https://ai-check.nodove.com
  AI_SERVE_API_KEY?: string;
  API_BASE_URL?: string; // e.g., https://api.nodove.com

  // Legacy: GEMINI_API_KEY는 더 이상 Workers에서 직접 사용하지 않음
  // 백엔드 서버에서 관리됩니다
  GEMINI_API_KEY?: string;

  // Email + site notification
  RESEND_API_KEY?: string;
  NOTIFY_FROM_EMAIL?: string;
  NOTIFY_TO_EMAILS?: string;
  PUBLIC_SITE_URL?: string;
  ASSETS_BASE_URL?: string;
  OPENCODE_AUTH_TOKEN?: string;
  GITHUB_TOKEN?: string;

  // Variables
  ENV: 'development' | 'production';
  ALLOWED_ORIGINS: string;

  // Secrets encryption key (optional, falls back to JWT_SECRET)
  SECRETS_ENCRYPTION_KEY?: string;
};

// Context extending Hono's context with our Env
export type Context = {
  env: Env;
  executionCtx: ExecutionContext;
};

// Standard API response
export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message: string;
  };
};

// Database Models
export type User = {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  status: 'draft' | 'published';
  author_id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Tag = {
  id: number;
  name: string;
};

export type Comment = {
  id: string;
  post_id: string;
  author: string;
  email: string | null;
  content: string;
  status: 'visible' | 'hidden' | 'pending';
  created_at: string;
  updated_at: string;
};

export type Attachment = {
  id: string;
  post_id: string;
  url: string;
  r2_key: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

// JWT Payload
export type JwtPayload = {
  sub: string;
  role: string;
  username: string;
  email?: string;
  emailVerified?: boolean;
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
};

// Auth Session for OTP verification
export type AuthSession = {
  id: string;
  username: string;
  email: string;
  otp_hash: string;
  otp_expires_at: string;
  is_verified: number;
  created_at: string;
};

// Post Analytics Models
export type PostView = {
  id: number;
  post_slug: string;
  year: string;
  view_date: string;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type PostStats = {
  id: number;
  post_slug: string;
  year: string;
  total_views: number;
  views_7d: number;
  views_30d: number;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EditorPick = {
  id: number;
  post_slug: string;
  year: string;
  title: string;
  cover_image: string | null;
  category: string | null;
  rank: number;
  score: number;
  reason: string | null;
  picked_at: string;
  expires_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// AI Model Management Types
// ============================================================================

export type AIProvider = {
  id: string;
  name: string;
  display_name: string;
  api_base_url: string | null;
  api_key_env: string | null;
  is_enabled: number;
  health_status: 'healthy' | 'degraded' | 'down' | 'unknown';
  last_health_check: string | null;
  created_at: string;
  updated_at: string;
};

export type AIModel = {
  id: string;
  provider_id: string;
  model_name: string;
  display_name: string;
  model_identifier: string;
  description: string | null;
  context_window: number | null;
  max_tokens: number | null;
  input_cost_per_1k: number | null;
  output_cost_per_1k: number | null;
  supports_vision: number;
  supports_streaming: number;
  supports_function_calling: number;
  is_enabled: number;
  priority: number;
  created_at: string;
  updated_at: string;
};

export type AIRoute = {
  id: string;
  name: string;
  description: string | null;
  routing_strategy: 'simple' | 'latency-based-routing' | 'cost-based-routing';
  primary_model_id: string | null;
  fallback_model_ids: string | null; // JSON array
  context_window_fallback_ids: string | null; // JSON array
  num_retries: number;
  timeout_seconds: number;
  is_default: number;
  is_enabled: number;
  created_at: string;
  updated_at: string;
};

export type AIUsageLog = {
  id: string;
  model_id: string | null;
  route_id: string | null;
  request_type: 'chat' | 'completion' | 'embedding' | 'vision';
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  latency_ms: number | null;
  status: 'success' | 'error' | 'timeout';
  error_message: string | null;
  user_id: string | null;
  metadata: string | null;
  created_at: string;
};

export type AIUsageDaily = {
  date: string;
  model_id: string;
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number | null;
};

// ============================================================================
// Secrets Management Types
// ============================================================================

export type SecretCategory = {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Secret = {
  id: string;
  category_id: string;
  key_name: string;
  display_name: string;
  description: string | null;
  encrypted_value: string | null;
  iv: string | null;
  is_required: number;
  is_sensitive: number;
  value_type: 'string' | 'number' | 'boolean' | 'json' | 'url';
  validation_pattern: string | null;
  default_value: string | null;
  env_fallback: string | null;
  last_rotated_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type SecretAuditLog = {
  id: number;
  secret_id: string;
  action: 'created' | 'updated' | 'deleted' | 'rotated' | 'accessed';
  old_value_hash: string | null;
  new_value_hash: string | null;
  changed_by: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  created_at: string;
};

export type SecretReference = {
  id: number;
  secret_id: string;
  reference_type: 'ai_provider' | 'route' | 'service' | 'integration';
  reference_id: string;
  reference_name: string | null;
  is_active: number;
  created_at: string;
};

export type SecretPublic = Omit<Secret, 'encrypted_value' | 'iv'> & {
  has_value: boolean;
  masked_value?: string;
  category_name?: string;
};

export type AITrace = {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  span_type: string;
  start_time_ms: number;
  end_time_ms: number | null;
  latency_ms: number | null;
  status: 'pending' | 'success' | 'error' | 'timeout';
  model_id: string | null;
  provider_id: string | null;
  route_id: string | null;
  user_id: string | null;
  request_path: string | null;
  request_method: string | null;
  response_status: number | null;
  error_message: string | null;
  tokens_used: number | null;
  estimated_cost: number | null;
  metadata: string | null;
  created_at: string;
};

export type AITraceSummary = {
  trace_id: string;
  total_spans: number;
  total_latency_ms: number | null;
  status: 'pending' | 'success' | 'error' | 'timeout';
  root_span_type: string | null;
  model_id: string | null;
  provider_id: string | null;
  user_id: string | null;
  request_path: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type TraceData = {
  traceId: string;
  spanId: string;
  startTimeMs: number;
  path: string;
  method: string;
};

export type Variables = {
  trace: TraceData;
  traceId: string;
  user: JwtPayload;
};

export type HonoEnv = {
  Bindings: Env;
  Variables: Variables;
};
