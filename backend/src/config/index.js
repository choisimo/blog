import path from 'node:path';
import { buildPublicRuntimeConfig } from '../../../shared/src/contracts/public-runtime-config.js';
import { configSchema } from './schema.js';
import { loadConsulConfig, consulGet } from './env.js';
import { CONSUL } from './constants.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('config');

export * from './constants.js';

let _config = null;
let _configPromise = null;
const PROTECTED_ENVS = new Set(['production', 'staging']);
const DEFAULT_REPO_ROOT = path.resolve(process.cwd(), '..');

export function isProtectedEnvironment(appEnv) {
  return PROTECTED_ENVS.has(appEnv || process.env.APP_ENV);
}

function resolveRepoRoot(rawRepoRoot) {
  const candidate =
    typeof rawRepoRoot === 'string' && rawRepoRoot.trim()
      ? rawRepoRoot.trim()
      : process.env.REPO_ROOT && String(process.env.REPO_ROOT).trim()
        ? String(process.env.REPO_ROOT).trim()
        : '';

  return candidate ? path.resolve(candidate) : DEFAULT_REPO_ROOT;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildPathConfig(raw) {
  const repoRoot = resolveRepoRoot(raw.REPO_ROOT);
  const frontendDir = path.join(repoRoot, 'frontend');
  const backendDir = path.join(repoRoot, 'backend');
  const workersDir = path.join(repoRoot, 'workers');
  const sharedDir = path.join(repoRoot, 'shared');
  const publicDir = raw.CONTENT_PUBLIC_DIR || path.join(frontendDir, 'public');
  const postsDir = raw.CONTENT_POSTS_DIR || path.join(publicDir, 'posts');
  const imagesDir = raw.CONTENT_IMAGES_DIR || path.join(publicDir, 'images');

  return {
    repoRoot,
    frontendDir,
    backendDir,
    workersDir,
    sharedDir,
    publicDir,
    postsDir,
    imagesDir,
  };
}

function createConfig(raw) {
  const paths = buildPathConfig(raw);
  const allowedOrigins = splitCsv(raw.ALLOWED_ORIGINS);
  const assetsBaseUrl = raw.ASSETS_BASE_URL;
  const terminalBlockedCountries = splitCsv(raw.TERMINAL_BLOCKED_COUNTRIES).map((entry) =>
    entry.toUpperCase(),
  );

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
      visionModel: raw.AI_VISION_MODEL,
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
    },

    totp: {
      secret: raw.TOTP_SECRET,
    },

    oauth: {
      allowedEmails: raw.ADMIN_ALLOWED_EMAILS,
      githubClientId: raw.GITHUB_CLIENT_ID,
      githubClientSecret: raw.GITHUB_CLIENT_SECRET,
      googleClientId: raw.GOOGLE_CLIENT_ID,
      googleClientSecret: raw.GOOGLE_CLIENT_SECRET,
      redirectBaseUrl: raw.OAUTH_REDIRECT_BASE_URL,
    },

    auth: {
      jwtSecret: raw.JWT_SECRET,
      jwtExpiresIn: raw.JWT_EXPIRES_IN,
    },

    security: {
      protectedEnvironment: isProtectedEnvironment(raw.APP_ENV),
      allowInsecureDevAuth: raw.ALLOW_INSECURE_DEV_AUTH === 'true',
      gatewaySigningSecret:
        raw.GATEWAY_SIGNING_SECRET || raw.BACKEND_GATEWAY_SIGNING_SECRET,
    },

    backendKey: raw.BACKEND_KEY,
    terminal: {
      sessionSecret: raw.TERMINAL_SESSION_SECRET,
      connectTokenTtlSeconds: raw.TERMINAL_CONNECT_TOKEN_TTL_SECONDS,
      sessionTimeoutMs: raw.TERMINAL_SESSION_TIMEOUT_MS,
      blockedCountries: terminalBlockedCountries,
    },
    paths,

    content: {
      repoRoot: paths.repoRoot,
      publicDir: paths.publicDir,
      postsDir: paths.postsDir,
      imagesDir: paths.imagesDir,
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
      password: raw.REDIS_PASSWORD || null,
    },

    search: {
      perplexityApiKey: raw.PERPLEXITY_API_KEY,
      tavilyApiKey: raw.TAVILY_API_KEY,
      braveApiKey: raw.BRAVE_SEARCH_API_KEY,
      serperApiKey: raw.SERPER_API_KEY,
    },

    services: {
      backendUrl: raw.INTERNAL_API_URL || `http://localhost:${raw.PORT}`,
      chatWebSocketEnabled: raw.CHAT_WS_ENABLED === 'true',
      terminalServerUrl: raw.TERMINAL_SERVER_URL,
      terminalGatewayUrl: raw.TERMINAL_GATEWAY_URL,
      openNotebookUrl: raw.OPEN_NOTEBOOK_URL,
      workerApiUrl: raw.WORKER_API_URL || null,
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
      codeExecutionEnabled: raw.FEATURE_CODE_EXECUTION_ENABLED === 'true',
      commentsEnabled: raw.FEATURE_COMMENTS_ENABLED === 'true',
      openNotebookEnabled: raw.OPEN_NOTEBOOK_ENABLED === 'true',
    },
  };
}

async function buildConfig() {
  const consulConfig = await loadConsulConfig();
  const merged = { ...process.env, ...consulConfig };
  const raw = configSchema.parse(merged);
  return createConfig(raw);
}

export async function initConfig() {
  if (_config) return _config;
  if (_configPromise) return _configPromise;

  _configPromise = buildConfig();
  _config = await _configPromise;
  return _config;
}

const syncConfig = configSchema.parse(process.env);

export const config = createConfig(syncConfig);

export function getSecurityConfigurationErrors(currentConfig = config) {
  const errors = [];
  const protectedEnvironment = currentConfig.security?.protectedEnvironment === true;
  const allowInsecureDevAuth = currentConfig.security?.allowInsecureDevAuth === true;

  if (!currentConfig.backendKey && (protectedEnvironment || !allowInsecureDevAuth)) {
    errors.push(
      protectedEnvironment
        ? 'BACKEND_KEY is required in protected environments'
        : 'BACKEND_KEY is required unless ALLOW_INSECURE_DEV_AUTH=true'
    );
  }

  if (!currentConfig.auth?.jwtSecret && (protectedEnvironment || !allowInsecureDevAuth)) {
    errors.push(
      protectedEnvironment
        ? 'JWT_SECRET is required in protected environments'
        : 'JWT_SECRET is required unless ALLOW_INSECURE_DEV_AUTH=true'
    );
  }

  if (
    !currentConfig.admin?.bearerToken &&
    !currentConfig.auth?.jwtSecret &&
    (protectedEnvironment || !allowInsecureDevAuth)
  ) {
    errors.push(
      protectedEnvironment
        ? 'ADMIN_BEARER_TOKEN or JWT_SECRET is required for admin routes in protected environments'
        : 'ADMIN_BEARER_TOKEN or JWT_SECRET is required for admin routes unless ALLOW_INSECURE_DEV_AUTH=true'
    );
  }

  if (!currentConfig.security?.gatewaySigningSecret && protectedEnvironment) {
    errors.push('GATEWAY_SIGNING_SECRET is required in protected environments');
  }

  const oauthConfigured = Boolean(
    currentConfig.oauth?.githubClientId ||
      currentConfig.oauth?.githubClientSecret ||
      currentConfig.oauth?.googleClientId ||
      currentConfig.oauth?.googleClientSecret,
  );
  if (protectedEnvironment && oauthConfigured && !currentConfig.oauth?.allowedEmails) {
    errors.push('ADMIN_ALLOWED_EMAILS is required for OAuth in protected environments');
  }

  return errors;
}

export function assertSecurityConfiguration(currentConfig = config) {
  const errors = getSecurityConfigurationErrors(currentConfig);
  if (errors.length > 0) {
    const err = new Error(`Security configuration is incomplete: ${errors.join('; ')}`);
    err.code = 'SECURITY_CONFIG_INCOMPLETE';
    throw err;
  }
}

if (!config.services.workerApiUrl) {
  logger.warn({}, 'WORKER_API_URL is not set - AI dynamic config from Worker will be unavailable. Set WORKER_API_URL to the api-gateway Worker URL.');
}

export async function loadAndApplyConsulConfig() {
  if (!CONSUL.ENABLED) {
    logger.info({}, 'Consul disabled, using environment variables');
    return config;
  }

  try {
    const asyncConfig = await initConfig();

    Object.assign(config, {
      siteBaseUrl: asyncConfig.siteBaseUrl,
      apiBaseUrl: asyncConfig.apiBaseUrl,
      allowedOrigins: asyncConfig.allowedOrigins,
      assetsBaseUrl: asyncConfig.assetsBaseUrl,
      admin: asyncConfig.admin,
      ai: asyncConfig.ai,
      auth: asyncConfig.auth,
      backendKey: asyncConfig.backendKey,
      content: asyncConfig.content,
      paths: asyncConfig.paths,
      rag: asyncConfig.rag,
      redis: asyncConfig.redis,
      security: asyncConfig.security,
      services: asyncConfig.services,
      terminal: asyncConfig.terminal,
      features: asyncConfig.features,
    });

    logger.info({}, 'Consul config applied successfully');
    return config;
  } catch (err) {
    logger.warn({}, 'Failed to apply Consul config', { error: err.message });
    return config;
  }
}

export function publicRuntimeConfig() {
  return buildPublicRuntimeConfig({
    env: config.appEnv,
    siteBaseUrl: config.siteBaseUrl,
    apiBaseUrl: config.apiBaseUrl,
    chatBaseUrl: config.apiBaseUrl,
    supportsChatWebSocket: false,
    terminalGatewayUrl: config.services.terminalGatewayUrl,
    ai: {
      modelSelectionEnabled: false,
      defaultModel: config.ai.defaultModel,
      visionModel: config.ai.visionModel,
    },
    features: {
      aiEnabled: config.features.aiEnabled,
      ragEnabled: config.features.ragEnabled,
      terminalEnabled: config.features.terminalEnabled,
      aiInline: config.features.aiInline,
      codeExecutionEnabled: config.features.codeExecutionEnabled,
      commentsEnabled: config.features.commentsEnabled,
    },
  });
}

export async function getServiceUrl(serviceName) {
  const url = await consulGet(`services/${serviceName}/url`);
  if (url) return url;

  const fallbacks = {
    backend: config.services?.backendUrl || `http://localhost:${config.port}`,
    chromadb: config.rag.chromaUrl,
    embedding: config.rag.embeddingUrl,
    redis: config.redis?.url || 'redis://localhost:6379',
    terminal: config.services?.terminalServerUrl || 'http://terminal-server:8080',
  };

  return fallbacks[serviceName] || null;
}

export { consulGet, loadConsulConfig } from './env.js';
