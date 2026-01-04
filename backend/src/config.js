import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';

// Load env: prefer root .env, then backend/.env overrides
const repoRoot = path.resolve(process.cwd(), '..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const schema = z.object({
  APP_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(5080),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  SITE_BASE_URL: z.string().url().default('https://noblog.nodove.com'),
  API_BASE_URL: z.string().default('http://localhost:5080'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  // ==========================================================================
  // AI Gateway (n8n) - Primary AI endpoint
  // ==========================================================================
  N8N_BASE_URL: z.string().default('http://n8n:5678'),
  N8N_WEBHOOK_URL: z.string().default('http://n8n:5678'),
  N8N_API_KEY: z.string().optional(),
  AI_DEFAULT_MODEL: z.string().default('gemini-1.5-flash'),

  // AI Engine (VAS Core) - For GitHub Copilot authentication only
  AI_ENGINE_URL: z.string().default('http://ai-engine:7012'),

  // ==========================================================================
  // OpenCode Serve - Primary AI endpoint (@opencode-ai/sdk based)
  // ==========================================================================
  OPENCODE_BASE_URL: z.string().default('http://opencode-backend:7016'),
  OPENCODE_API_KEY: z.string().optional(),
  OPENCODE_DEFAULT_PROVIDER: z.string().default('github-copilot'),
  OPENCODE_DEFAULT_MODEL: z.string().default('gpt-4.1'),

  // Direct provider API keys (used by n8n AI nodes)
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),  // Alternative name for Gemini API key
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // JWT Configuration
  JWT_EXPIRES_IN: z.string().default('12h'),

  // ==========================================================================
  // Cloudflare D1 (Primary database for all data)
  // ==========================================================================
  CF_ACCOUNT_ID: z.string().optional(),
  CF_API_TOKEN: z.string().optional(),
  D1_DATABASE_ID: z.string().optional(),

  // Cloudflare R2 (for image storage)
  R2_BUCKET_NAME: z.string().default('blog'),
  R2_ASSETS_BASE_URL: z.string().default('https://assets-b.nodove.com'),

  // ==========================================================================
  // Firebase (DEPRECATED - Use D1 instead)
  // ==========================================================================
  // These are kept for backward compatibility during migration.
  // Remove after confirming all data is migrated to D1.
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),

  GITHUB_TOKEN: z.string().optional(),
  GITHUB_REPO_OWNER: z.string().optional(),
  GITHUB_REPO_NAME: z.string().optional(),
  GIT_USER_NAME: z.string().optional(),
  GIT_USER_EMAIL: z.string().optional(),

  ADMIN_BEARER_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  VERCEL_DEPLOY_HOOK_URL: z.string().optional(),

  // ==========================================================================
  // RAG Services
  // ==========================================================================
  TEI_URL: z.string().default('http://embedding-server:80'),
  CHROMA_URL: z.string().default('http://chromadb:8000'),
  CHROMA_COLLECTION: z.string().default('blog-posts-all-MiniLM-L6-v2'),

  // ==========================================================================
  // Content Paths (configurable for Docker)
  // ==========================================================================
  CONTENT_PUBLIC_DIR: z.string().optional(),
  CONTENT_POSTS_DIR: z.string().optional(),
  CONTENT_IMAGES_DIR: z.string().optional(),
  
  // Posts source: 'filesystem' | 'github' | 'r2'
  POSTS_SOURCE: z.enum(['filesystem', 'github', 'r2']).default('filesystem'),
});

const raw = schema.parse(process.env);

const allowedOrigins = raw.ALLOWED_ORIGINS.split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Content paths - use environment variables if set, otherwise compute from repoRoot
const publicDir = raw.CONTENT_PUBLIC_DIR || path.join(repoRoot, 'frontend', 'public');
const postsDir = raw.CONTENT_POSTS_DIR || path.join(publicDir, 'posts');
const imagesDir = raw.CONTENT_IMAGES_DIR || path.join(publicDir, 'images');

export const config = {
  appEnv: raw.APP_ENV,
  host: raw.HOST,
  port: raw.PORT,
  trustProxy: raw.TRUST_PROXY,
  logLevel: raw.LOG_LEVEL,

  siteBaseUrl: raw.SITE_BASE_URL,
  apiBaseUrl: raw.API_BASE_URL,
  allowedOrigins,

  rateLimit: {
    max: raw.RATE_LIMIT_MAX,
    windowMs: raw.RATE_LIMIT_WINDOW_MS,
  },

  // ==========================================================================
  // AI Gateway (n8n) - Primary AI endpoint
  // ==========================================================================
  ai: {
    // n8n Gateway (Webhook-based)
    gateway: {
      baseUrl: raw.N8N_BASE_URL,
      webhookUrl: raw.N8N_WEBHOOK_URL,
      apiKey: raw.N8N_API_KEY,
      defaultModel: raw.AI_DEFAULT_MODEL,
    },
    // AI Engine (for GitHub Copilot auth only)
    engine: {
      url: raw.AI_ENGINE_URL,
    },
    // OpenCode Backend (Primary - @opencode-ai/sdk based API)
    opencode: {
      baseUrl: raw.OPENCODE_BASE_URL,
      apiKey: raw.OPENCODE_API_KEY,
      defaultProvider: raw.OPENCODE_DEFAULT_PROVIDER,
      defaultModel: raw.OPENCODE_DEFAULT_MODEL,
    },
    // Direct provider keys (used by n8n)
    providers: {
      gemini: raw.GEMINI_API_KEY,
      openai: raw.OPENAI_API_KEY,
      anthropic: raw.ANTHROPIC_API_KEY,
    },
  },

  // ==========================================================================
  // Firebase (DEPRECATED - kept for migration reference)
  // ==========================================================================
  firebase: {
    serviceAccountJson: raw.FIREBASE_SERVICE_ACCOUNT_JSON,
    projectId: raw.FIREBASE_PROJECT_ID,
    _deprecated: true,
  },

  github: {
    token: raw.GITHUB_TOKEN,
    owner: raw.GITHUB_REPO_OWNER,
    repo: raw.GITHUB_REPO_NAME,
    gitUserName: raw.GIT_USER_NAME,
    gitUserEmail: raw.GIT_USER_EMAIL,
  },

  admin: {
    bearerToken: raw.ADMIN_BEARER_TOKEN,
    username: raw.ADMIN_USERNAME,
    password: raw.ADMIN_PASSWORD,
  },

  auth: {
    jwtSecret: raw.JWT_SECRET,
    jwtExpiresIn: raw.JWT_EXPIRES_IN,
  },

  content: {
    repoRoot,
    publicDir,
    postsDir,
    imagesDir,
    postsSource: raw.POSTS_SOURCE,
  },

  integrations: {
    vercelDeployHookUrl: raw.VERCEL_DEPLOY_HOOK_URL,
  },

  rag: {
    teiUrl: raw.TEI_URL,
    chromaUrl: raw.CHROMA_URL,
    chromaCollection: raw.CHROMA_COLLECTION,
  },

  // ==========================================================================
  // Shortcut references for legacy compatibility
  // ==========================================================================
  gemini: {
    apiKey: raw.GEMINI_API_KEY || raw.GOOGLE_API_KEY,
    model: raw.AI_DEFAULT_MODEL || 'gemini-2.0-flash',
  },
};

export function publicRuntimeConfig() {
  return {
    siteBaseUrl: config.siteBaseUrl,
    apiBaseUrl: config.apiBaseUrl,
    env: config.appEnv,
    features: {
      aiInline: true,
    },
  };
}
