// Cloudflare Workers Environment Bindings
export type Env = {
  // Bindings
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;

  // Secrets
  JWT_SECRET: string;
  GEMINI_API_KEY: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  AI_SERVE_BASE_URL?: string;
  AI_SERVE_API_KEY?: string;
  AI_GATEWAY_CALLER_KEY?: string;
  // Email + site notification
  RESEND_API_KEY?: string;
  NOTIFY_FROM_EMAIL?: string;
  NOTIFY_TO_EMAILS?: string;
  PUBLIC_SITE_URL?: string;
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
