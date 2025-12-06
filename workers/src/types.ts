// Cloudflare Workers Environment Bindings
export type Env = {
  // Bindings
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;

  // Secrets
  JWT_SECRET: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;

  // Backend AI Server (via Cloudflare Tunnel)
  // 모든 AI 호출은 이 서버를 통해 처리됩니다
  AI_SERVE_BASE_URL?: string; // e.g., https://ai-check.nodove.com
  AI_SERVE_API_KEY?: string;
  AI_GATEWAY_CALLER_KEY?: string;
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
  iat?: number;
  exp?: number;
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
