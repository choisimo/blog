import { z } from "zod";
import {
  AI_API,
  AI_MODELS,
  CHROMA,
  FEATURES,
  INTERNAL_SERVICES,
  RATE_LIMIT,
  SERVER,
} from "./constants.js";

export const configSchema = z.object({
  APP_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default(SERVER.ENV),
  HOST: z.string().default(SERVER.HOST),
  PORT: z.coerce.number().int().positive().default(SERVER.PORT),
  TRUST_PROXY: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(SERVER.TRUST_PROXY),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default(SERVER.LOG_LEVEL),

  SITE_BASE_URL: z.string().url().default("https://noblog.nodove.com"),
  API_BASE_URL: z.string().default("http://localhost:5080"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(RATE_LIMIT.MAX),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(RATE_LIMIT.WINDOW_MS),

  AI_SERVER_URL: z.string().default(AI_API.BASE_URL),
  AI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_DEFAULT_MODEL: z.string().default(AI_MODELS.DEFAULT),
  AI_ASYNC_MODE: z.enum(["true", "false"]).default("false"),

  JWT_EXPIRES_IN: z.string().default("12h"),

  ASSETS_BASE_URL: z.string().optional(),

  GITHUB_TOKEN: z.string().optional(),
  GITHUB_REPO_OWNER: z.string().optional(),
  GITHUB_REPO_NAME: z.string().optional(),
  GIT_USER_NAME: z.string().optional(),
  GIT_USER_EMAIL: z.string().optional(),

  ADMIN_BEARER_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  TOTP_SECRET: z.string().optional(),
  ADMIN_ALLOWED_EMAILS: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_REDIRECT_BASE_URL: z.string().optional(),
  VERCEL_DEPLOY_HOOK_URL: z.string().optional(),

  AI_EMBEDDING_URL: z.string().default(AI_API.EMBEDDING_URL),
  AI_EMBEDDING_API_KEY: z.string().optional(),
  AI_EMBED_MODEL: z.string().default(AI_MODELS.EMBEDDING),
  CHROMA_URL: z.string().default(CHROMA.URL),
  CHROMA_COLLECTION: z.string().default(CHROMA.COLLECTION),
  REDIS_URL: z.string().optional(),

  BACKEND_KEY: z.string().optional(),

  OPEN_NOTEBOOK_URL: z.string().default(INTERNAL_SERVICES.OPEN_NOTEBOOK_URL),
  OPEN_NOTEBOOK_ENABLED: z.enum(["true", "false"]).default("false"),

  PERPLEXITY_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),

  INTERNAL_API_URL: z.string().optional(),
  WORKER_API_URL: z.string().optional(),
  TERMINAL_SERVER_URL: z
    .string()
    .default(INTERNAL_SERVICES.TERMINAL_SERVER_URL),
  TERMINAL_GATEWAY_URL: z
    .string()
    .default(INTERNAL_SERVICES.TERMINAL_GATEWAY_URL),

  CONTENT_PUBLIC_DIR: z.string().optional(),
  CONTENT_POSTS_DIR: z.string().optional(),
  CONTENT_IMAGES_DIR: z.string().optional(),
  POSTS_SOURCE: z.enum(["filesystem", "github"]).default("filesystem"),

  USE_CONSUL: z.string().optional(),
  CONSUL_HOST: z.string().optional(),
  CONSUL_PORT: z.coerce.number().optional(),

  FEATURE_AI_ENABLED: z
    .enum(["true", "false"])
    .default(FEATURES.AI_ENABLED ? "true" : "false"),
  FEATURE_RAG_ENABLED: z
    .enum(["true", "false"])
    .default(FEATURES.RAG_ENABLED ? "true" : "false"),
  FEATURE_TERMINAL_ENABLED: z
    .enum(["true", "false"])
    .default(FEATURES.TERMINAL_ENABLED ? "true" : "false"),
  FEATURE_AI_INLINE: z
    .enum(["true", "false"])
    .default(FEATURES.AI_INLINE ? "true" : "false"),
  FEATURE_COMMENTS_ENABLED: z
    .enum(["true", "false"])
    .default(FEATURES.COMMENTS_ENABLED ? "true" : "false"),
});

export default configSchema;
