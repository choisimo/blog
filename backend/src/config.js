import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const USE_CONSUL = process.env.USE_CONSUL === 'true';
const CONSUL_HOST = process.env.CONSUL_HOST || 'consul';
const CONSUL_PORT = parseInt(process.env.CONSUL_PORT || '8500', 10);
const CONFIG_PREFIX = 'blog';

let consulClient = null;
let consulCache = new Map();
const CONSUL_CACHE_TTL = 30000;

async function initConsul() {
  if (!USE_CONSUL || consulClient) return consulClient;
  
  try {
    const Consul = (await import('consul')).default;
    consulClient = new Consul({
      host: CONSUL_HOST,
      port: CONSUL_PORT,
      promisify: true,
    });
    
    const leader = await consulClient.status.leader();
    if (leader) {
      console.log(`[config] Consul connected: ${CONSUL_HOST}:${CONSUL_PORT}`);
    }
    return consulClient;
  } catch (err) {
    console.warn(`[config] Consul unavailable, using environment: ${err.message}`);
    return null;
  }
}

async function consulGet(key) {
  if (!USE_CONSUL) return null;
  
  const cacheKey = `kv:${key}`;
  const cached = consulCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CONSUL_CACHE_TTL) {
    return cached.value;
  }

  try {
    const client = await initConsul();
    if (!client) return null;

    const result = await client.kv.get(`${CONFIG_PREFIX}/${key}`);
    if (result?.Value) {
      let value;
      try {
        value = JSON.parse(result.Value);
      } catch {
        value = result.Value;
      }
      consulCache.set(cacheKey, { value, ts: Date.now() });
      return value;
    }
  } catch (err) {
    console.warn(`[config] Consul get failed for ${key}: ${err.message}`);
  }
  return null;
}

async function loadConsulConfig() {
  if (!USE_CONSUL) return {};

  const keys = [
    // Domain configuration
    ['config/domains/frontend', 'SITE_BASE_URL'],
    ['config/domains/api', 'API_BASE_URL'],
    ['config/domains/assets', 'ASSETS_BASE_URL'],
    ['config/domains/terminal', 'TERMINAL_GATEWAY_URL'],
    ['config/cors/allowed_origins', 'ALLOWED_ORIGINS'],
    
    // Feature flags
    ['config/features/ai_enabled', 'FEATURE_AI_ENABLED'],
    ['config/features/rag_enabled', 'FEATURE_RAG_ENABLED'],
    ['config/features/terminal_enabled', 'FEATURE_TERMINAL_ENABLED'],
    ['config/features/ai_inline', 'FEATURE_AI_INLINE'],
    ['config/features/comments_enabled', 'FEATURE_COMMENTS_ENABLED'],
    
    // AI services
    ['services/ai/url', 'AI_SERVER_URL'],
    
    // RAG services
    ['services/embedding/url', 'TEI_URL'],
    ['services/chromadb/url', 'CHROMA_URL'],
    ['services/chromadb/collection', 'CHROMA_COLLECTION'],
    
    // Infrastructure services
    ['services/redis/url', 'REDIS_URL'],
    ['services/backend/url', 'INTERNAL_API_URL'],
    ['services/terminal/url', 'TERMINAL_SERVER_URL'],
  ];

  const config = {};
  await Promise.all(
    keys.map(async ([consulKey, envKey]) => {
      const value = await consulGet(consulKey);
      if (value !== null) {
        config[envKey] = Array.isArray(value) ? value.join(',') : value;
      }
    })
  );

  return config;
}

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

  AI_SERVER_URL: z.string().default('http://litellm:4000/v1'),
  LITELLM_URL: z.string().default('http://litellm:4000'),
  AI_DEFAULT_MODEL: z.string().default('gpt-4.1'),
  AI_ASYNC_MODE: z.enum(['true', 'false']).default('false'),

  JWT_EXPIRES_IN: z.string().default('12h'),

  ASSETS_BASE_URL: z.string().optional(),

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

  TEI_URL: z.string().default('http://embedding-server:80'),
  CHROMA_URL: z.string().default('http://chromadb:8000'),
  CHROMA_COLLECTION: z.string().default('blog-posts__all-MiniLM-L6-v2'),
  REDIS_URL: z.string().optional(),

  PERPLEXITY_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),

  INTERNAL_API_URL: z.string().optional(),
  TERMINAL_SERVER_URL: z.string().default('http://terminal-server:8080'),
  TERMINAL_GATEWAY_URL: z.string().default('https://terminal.nodove.com'),

  CONTENT_PUBLIC_DIR: z.string().optional(),
  CONTENT_POSTS_DIR: z.string().optional(),
  CONTENT_IMAGES_DIR: z.string().optional(),
  POSTS_SOURCE: z.enum(['filesystem', 'github']).default('filesystem'),
  
  USE_CONSUL: z.string().optional(),
  CONSUL_HOST: z.string().optional(),
  CONSUL_PORT: z.coerce.number().optional(),
  
  FEATURE_AI_ENABLED: z.enum(['true', 'false']).default('true'),
  FEATURE_RAG_ENABLED: z.enum(['true', 'false']).default('true'),
  FEATURE_TERMINAL_ENABLED: z.enum(['true', 'false']).default('true'),
  FEATURE_AI_INLINE: z.enum(['true', 'false']).default('true'),
  FEATURE_COMMENTS_ENABLED: z.enum(['true', 'false']).default('true'),
});

let _config = null;
let _configPromise = null;

async function buildConfig() {
  const consulConfig = await loadConsulConfig();
  const merged = { ...consulConfig, ...process.env };
  const raw = schema.parse(merged);

  const repoRoot = path.resolve(process.cwd(), '..');
  const allowedOrigins = raw.ALLOWED_ORIGINS.split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const publicDir = raw.CONTENT_PUBLIC_DIR || path.join(repoRoot, 'frontend', 'public');
  const postsDir = raw.CONTENT_POSTS_DIR || path.join(publicDir, 'posts');
  const imagesDir = raw.CONTENT_IMAGES_DIR || path.join(publicDir, 'images');
  const assetsBaseUrl = raw.ASSETS_BASE_URL;

  return {
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

    ai: {
      baseUrl: raw.AI_SERVER_URL || (raw.LITELLM_URL ? raw.LITELLM_URL + '/v1' : 'http://litellm:4000/v1'),
      defaultModel: raw.AI_DEFAULT_MODEL,
      asyncMode: raw.AI_ASYNC_MODE === 'true',
      litellmUrl: raw.LITELLM_URL || 'http://litellm:4000',
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

    assetsBaseUrl,

    integrations: {
      vercelDeployHookUrl: raw.VERCEL_DEPLOY_HOOK_URL,
    },

    rag: {
      teiUrl: raw.TEI_URL,
      chromaUrl: raw.CHROMA_URL,
      chromaCollection: raw.CHROMA_COLLECTION,
    },

    redis: {
      url: raw.REDIS_URL,
    },

    search: {
      perplexityApiKey: raw.PERPLEXITY_API_KEY,
      tavilyApiKey: raw.TAVILY_API_KEY,
      braveApiKey: raw.BRAVE_SEARCH_API_KEY,
      serperApiKey: raw.SERPER_API_KEY,
    },

    services: {
      backendUrl: raw.INTERNAL_API_URL || `http://localhost:${raw.PORT}`,
      terminalServerUrl: raw.TERMINAL_SERVER_URL,
      terminalGatewayUrl: raw.TERMINAL_GATEWAY_URL,
    },

    consul: {
      enabled: USE_CONSUL,
      host: CONSUL_HOST,
      port: CONSUL_PORT,
    },

    features: {
      aiEnabled: raw.FEATURE_AI_ENABLED === 'true',
      ragEnabled: raw.FEATURE_RAG_ENABLED === 'true',
      terminalEnabled: raw.FEATURE_TERMINAL_ENABLED === 'true',
      aiInline: raw.FEATURE_AI_INLINE === 'true',
      commentsEnabled: raw.FEATURE_COMMENTS_ENABLED === 'true',
    },
  };
}

export async function initConfig() {
  if (_config) return _config;
  if (_configPromise) return _configPromise;
  
  _configPromise = buildConfig();
  _config = await _configPromise;
  return _config;
}

export async function loadAndApplyConsulConfig() {
  if (!USE_CONSUL) {
    console.log('[config] Consul disabled, using environment variables');
    return config;
  }

  try {
    const asyncConfig = await initConfig();
    
    Object.assign(config, {
      siteBaseUrl: asyncConfig.siteBaseUrl,
      apiBaseUrl: asyncConfig.apiBaseUrl,
      allowedOrigins: asyncConfig.allowedOrigins,
      assetsBaseUrl: asyncConfig.assetsBaseUrl,
      ai: asyncConfig.ai,
      rag: asyncConfig.rag,
      redis: asyncConfig.redis,
      services: asyncConfig.services,
      features: asyncConfig.features,
    });
    
    console.log('[config] Consul config applied successfully');
    return config;
  } catch (err) {
    console.warn(`[config] Failed to apply Consul config: ${err.message}`);
    return config;
  }
}

const syncConfig = schema.parse(process.env);
const repoRoot = path.resolve(process.cwd(), '..');
const allowedOrigins = syncConfig.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
const publicDir = syncConfig.CONTENT_PUBLIC_DIR || path.join(repoRoot, 'frontend', 'public');

export const config = {
  appEnv: syncConfig.APP_ENV,
  host: syncConfig.HOST,
  port: syncConfig.PORT,
  trustProxy: syncConfig.TRUST_PROXY,
  logLevel: syncConfig.LOG_LEVEL,
  siteBaseUrl: syncConfig.SITE_BASE_URL,
  apiBaseUrl: syncConfig.API_BASE_URL,
  allowedOrigins,
  assetsBaseUrl: syncConfig.ASSETS_BASE_URL,
  rateLimit: {
    max: syncConfig.RATE_LIMIT_MAX,
    windowMs: syncConfig.RATE_LIMIT_WINDOW_MS,
  },
  ai: {
    baseUrl: syncConfig.AI_SERVER_URL || (syncConfig.LITELLM_URL ? syncConfig.LITELLM_URL + '/v1' : 'http://litellm:4000/v1'),
    defaultModel: syncConfig.AI_DEFAULT_MODEL,
    asyncMode: syncConfig.AI_ASYNC_MODE === 'true',
    litellmUrl: syncConfig.LITELLM_URL || 'http://litellm:4000',
  },
  github: {
    token: syncConfig.GITHUB_TOKEN,
    owner: syncConfig.GITHUB_REPO_OWNER,
    repo: syncConfig.GITHUB_REPO_NAME,
    gitUserName: syncConfig.GIT_USER_NAME,
    gitUserEmail: syncConfig.GIT_USER_EMAIL,
  },
  admin: {
    bearerToken: syncConfig.ADMIN_BEARER_TOKEN,
    username: syncConfig.ADMIN_USERNAME,
    password: syncConfig.ADMIN_PASSWORD,
  },
  auth: {
    jwtSecret: syncConfig.JWT_SECRET,
    jwtExpiresIn: syncConfig.JWT_EXPIRES_IN,
  },
  content: {
    repoRoot,
    publicDir,
    postsDir: syncConfig.CONTENT_POSTS_DIR || path.join(publicDir, 'posts'),
    imagesDir: syncConfig.CONTENT_IMAGES_DIR || path.join(publicDir, 'images'),
    postsSource: syncConfig.POSTS_SOURCE,
  },
  integrations: {
    vercelDeployHookUrl: syncConfig.VERCEL_DEPLOY_HOOK_URL,
  },
  rag: {
    teiUrl: syncConfig.TEI_URL,
    chromaUrl: syncConfig.CHROMA_URL,
    chromaCollection: syncConfig.CHROMA_COLLECTION,
  },
  redis: {
    url: syncConfig.REDIS_URL,
  },
  search: {
    perplexityApiKey: syncConfig.PERPLEXITY_API_KEY,
    tavilyApiKey: syncConfig.TAVILY_API_KEY,
    braveApiKey: syncConfig.BRAVE_SEARCH_API_KEY,
    serperApiKey: syncConfig.SERPER_API_KEY,
  },
  services: {
    backendUrl: syncConfig.INTERNAL_API_URL || `http://localhost:${syncConfig.PORT}`,
    terminalServerUrl: syncConfig.TERMINAL_SERVER_URL,
    terminalGatewayUrl: syncConfig.TERMINAL_GATEWAY_URL,
  },
  consul: {
    enabled: USE_CONSUL,
    host: CONSUL_HOST,
    port: CONSUL_PORT,
  },
  features: {
    aiEnabled: syncConfig.FEATURE_AI_ENABLED === 'true',
    ragEnabled: syncConfig.FEATURE_RAG_ENABLED === 'true',
    terminalEnabled: syncConfig.FEATURE_TERMINAL_ENABLED === 'true',
    aiInline: syncConfig.FEATURE_AI_INLINE === 'true',
    commentsEnabled: syncConfig.FEATURE_COMMENTS_ENABLED === 'true',
  },
};

export function publicRuntimeConfig() {
  return {
    siteBaseUrl: config.siteBaseUrl,
    apiBaseUrl: config.apiBaseUrl,
    env: config.appEnv,
    features: {
      aiEnabled: config.features.aiEnabled,
      ragEnabled: config.features.ragEnabled,
      terminalEnabled: config.features.terminalEnabled,
      aiInline: config.features.aiInline,
      commentsEnabled: config.features.commentsEnabled,
    },
  };
}

export async function getServiceUrl(serviceName) {
  const url = await consulGet(`services/${serviceName}/url`);
  if (url) return url;
  
  const fallbacks = {
    'backend': config.services?.backendUrl || `http://localhost:${config.port}`,
    'chromadb': config.rag.chromaUrl,
    'embedding': config.rag.teiUrl,
    'redis': config.redis?.url || 'redis://localhost:6379',
    'terminal': config.services?.terminalServerUrl || 'http://terminal-server:8080',
  };
  
  return fallbacks[serviceName] || null;
}

export { consulGet, loadConsulConfig };
