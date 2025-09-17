import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';

// Load env once (no-op if already loaded)
dotenv.config();

const schema = z.object({
  APP_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(5080),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  SITE_BASE_URL: z.string().url().default('https://blog.nodove.com'),
  API_BASE_URL: z.string().default('http://localhost:5080'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),

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
});

const raw = schema.parse(process.env);

const allowedOrigins = raw.ALLOWED_ORIGINS.split(',')
  .map(s => s.trim())
  .filter(Boolean);

const repoRoot = path.resolve(process.cwd(), '..');
const publicDir = path.join(repoRoot, 'frontend', 'public');
const postsDir = path.join(publicDir, 'posts');
const imagesDir = path.join(publicDir, 'images');

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

  gemini: {
    apiKey: raw.GEMINI_API_KEY,
    model: raw.GEMINI_MODEL,
  },

  firebase: {
    serviceAccountJson: raw.FIREBASE_SERVICE_ACCOUNT_JSON,
    projectId: raw.FIREBASE_PROJECT_ID,
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
    jwtExpiresIn: '12h',
  },

  content: {
    repoRoot,
    publicDir,
    postsDir,
    imagesDir,
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
