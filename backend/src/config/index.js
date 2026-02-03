import path from 'node:path';
import { configSchema } from './schema.js';
import { loadConsulConfig, consulGet } from './env.js';
import { CONSUL } from './constants.js';

export * from './constants.js';

let _config = null;
let _configPromise = null;

async function buildConfig() {
  const consulConfig = await loadConsulConfig();
  const merged = { ...consulConfig, ...process.env };
  const raw = configSchema.parse(merged);

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
      baseUrl: raw.AI_SERVER_URL,
      apiKey: raw.AI_API_KEY || raw.OPENAI_API_KEY,
      defaultModel: raw.AI_DEFAULT_MODEL,
      asyncMode: raw.AI_ASYNC_MODE === 'true',
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

    backendKey: raw.BACKEND_KEY,

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
      embeddingUrl: raw.AI_EMBEDDING_URL || raw.AI_SERVER_URL,
      embeddingApiKey: raw.AI_EMBEDDING_API_KEY || raw.AI_API_KEY || raw.OPENAI_API_KEY,
      embeddingModel: raw.AI_EMBED_MODEL,
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
      enabled: CONSUL.ENABLED,
      host: CONSUL.HOST,
      port: CONSUL.PORT,
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

const syncConfig = configSchema.parse(process.env);
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
    baseUrl: syncConfig.AI_SERVER_URL,
    apiKey: syncConfig.AI_API_KEY || syncConfig.OPENAI_API_KEY,
    defaultModel: syncConfig.AI_DEFAULT_MODEL,
    asyncMode: syncConfig.AI_ASYNC_MODE === 'true',
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
  backendKey: syncConfig.BACKEND_KEY,
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
    embeddingUrl: syncConfig.AI_EMBEDDING_URL || syncConfig.AI_SERVER_URL,
    embeddingApiKey: syncConfig.AI_EMBEDDING_API_KEY || syncConfig.AI_API_KEY || syncConfig.OPENAI_API_KEY,
    embeddingModel: syncConfig.AI_EMBED_MODEL,
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
    enabled: CONSUL.ENABLED,
    host: CONSUL.HOST,
    port: CONSUL.PORT,
  },
  features: {
    aiEnabled: syncConfig.FEATURE_AI_ENABLED === 'true',
    ragEnabled: syncConfig.FEATURE_RAG_ENABLED === 'true',
    terminalEnabled: syncConfig.FEATURE_TERMINAL_ENABLED === 'true',
    aiInline: syncConfig.FEATURE_AI_INLINE === 'true',
    commentsEnabled: syncConfig.FEATURE_COMMENTS_ENABLED === 'true',
  },
};

export async function loadAndApplyConsulConfig() {
  if (!CONSUL.ENABLED) {
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
    'embedding': config.rag.embeddingUrl,
    'redis': config.redis?.url || 'redis://localhost:6379',
    'terminal': config.services?.terminalServerUrl || 'http://terminal-server:8080',
  };

  return fallbacks[serviceName] || null;
}

export { consulGet, loadConsulConfig } from './env.js';
