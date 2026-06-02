import {
  CONFIG_CLASSIFICATIONS,
  CONFIG_CLASSIFICATION_VALUES,
  isSecretLikeKey,
} from './config-classification.js';
import { CONFIG_DELIVERY, CONFIG_DELIVERY_VALUES } from './config-delivery.js';
import { CONFIG_SCOPES, CONFIG_SCOPE_VALUES } from './config-scopes.js';

const C = CONFIG_CLASSIFICATIONS;
const D = CONFIG_DELIVERY;
const S = CONFIG_SCOPES;

function entry(key, options) {
  return Object.freeze({
    key,
    owner: options.owner,
    classification: options.classification,
    scopes: Object.freeze(options.scopes || []),
    requiredIn: Object.freeze(options.requiredIn || []),
    delivery: Object.freeze(options.delivery || [D.PROCESS_ENV]),
    publicExposure: options.publicExposure === true,
    mutableAtRuntime: options.mutableAtRuntime === true,
    rotation: options.rotation || 'manual',
    deprecatedAliases: Object.freeze(options.deprecatedAliases || []),
    description: options.description || '',
    defaultValue: options.defaultValue,
    valueType: options.valueType || 'string',
    admin: Object.freeze(options.admin || {}),
    publicExposureReason: options.publicExposureReason || null,
  });
}

function entries(keys, options, perKey = {}) {
  return keys.map((key) => entry(key, { ...options, ...(perKey[key] || {}) }));
}

const publicRuntimeKeys = entries(
  [
    'APP_ENV',
    'NODE_ENV',
    'SITE_BASE_URL',
    'PUBLIC_SITE_URL',
    'API_BASE_URL',
    'CHAT_BASE_URL',
    'CHAT_WS_BASE_URL',
    'TERMINAL_GATEWAY_URL',
    'AI_DEFAULT_MODEL',
    'AI_VISION_MODEL',
    'FEATURE_AI_ENABLED',
    'FEATURE_RAG_ENABLED',
    'FEATURE_TERMINAL_ENABLED',
    'FEATURE_AI_INLINE',
    'FEATURE_CODE_EXECUTION_ENABLED',
    'FEATURE_COMMENTS_ENABLED',
    'FEATURE_ADMIN_AI_IMAGE_ENABLED',
    'VITE_SITE_BASE_URL',
    'VITE_API_BASE_URL',
    'VITE_CHAT_BASE_URL',
    'VITE_CHAT_WS_BASE_URL',
    'VITE_TERMINAL_GATEWAY_URL',
    'VITE_FEATURE_AI_ENABLED',
    'VITE_FEATURE_RAG_ENABLED',
    'VITE_FEATURE_TERMINAL_ENABLED',
    'VITE_FEATURE_AI_INLINE',
    'VITE_FEATURE_CODE_EXECUTION_ENABLED',
    'VITE_FEATURE_COMMENTS_ENABLED',
    'VITE_FEATURE_FAB',
    'VITE_AI_UNIFIED',
    'VITE_SITE_NAME',
    'VITE_AUTHOR_NAME',
    'SITE_NAME',
    'VITE_EMAILJS_SERVICE_ID',
    'VITE_EMAILJS_TEMPLATE_ID',
    'VITE_EMAILJS_PUBLIC_KEY',
    'BASE_URL',
    'DEV',
    'PROD',
    'MODE',
    'SSR',
  ],
  {
    owner: 'frontend-platform',
    classification: C.PUBLIC_CONFIG,
    scopes: [S.FRONTEND, S.BACKEND, S.API_GATEWAY],
    delivery: [D.FRONTEND_RUNTIME_JSON, D.VITE_BUILD_VAR, D.PROCESS_ENV, D.WRANGLER_VAR],
    publicExposure: true,
    mutableAtRuntime: false,
    rotation: 'not-secret',
  },
  {
    APP_ENV: {
      scopes: [S.BACKEND, S.K3S, S.FRONTEND],
      delivery: [D.PROCESS_ENV, D.K3S_CONFIGMAP, D.FRONTEND_RUNTIME_JSON],
    },
    NODE_ENV: {
      scopes: [S.FRONTEND, S.BACKEND],
      delivery: [D.PROCESS_ENV, D.VITE_BUILD_VAR],
    },
    AI_DEFAULT_MODEL: {
      classification: C.RUNTIME_MUTABLE_CONFIG,
      scopes: [S.BACKEND, S.API_GATEWAY, S.FRONTEND, S.K3S],
      delivery: [D.PROCESS_ENV, D.K3S_CONFIGMAP, D.WRANGLER_VAR, D.KV_DYNAMIC_CONFIG],
      mutableAtRuntime: true,
    },
    AI_VISION_MODEL: {
      classification: C.RUNTIME_MUTABLE_CONFIG,
      scopes: [S.BACKEND, S.API_GATEWAY, S.FRONTEND],
      delivery: [D.PROCESS_ENV, D.WRANGLER_VAR, D.KV_DYNAMIC_CONFIG],
      mutableAtRuntime: true,
    },
    VITE_EMAILJS_PUBLIC_KEY: {
      publicExposureReason: 'EmailJS browser public token; not an authentication secret.',
    },
    TERMINAL_GATEWAY_URL: {
      scopes: [S.BACKEND, S.TERMINAL_GATEWAY, S.FRONTEND, S.K3S],
      delivery: [D.PROCESS_ENV, D.K3S_CONFIGMAP, D.WRANGLER_VAR, D.FRONTEND_RUNTIME_JSON],
    },
    API_BASE_URL: {
      classification: C.RUNTIME_MUTABLE_CONFIG,
      scopes: [S.BACKEND, S.API_GATEWAY, S.FRONTEND, S.K3S],
      delivery: [D.PROCESS_ENV, D.K3S_CONFIGMAP, D.KV_DYNAMIC_CONFIG, D.FRONTEND_RUNTIME_JSON],
      mutableAtRuntime: true,
    },
  },
);

const coreSecrets = [
  entry('JWT_SECRET', {
    owner: 'platform-security',
    classification: C.SECRET,
    scopes: [S.BACKEND, S.API_GATEWAY, S.TERMINAL_GATEWAY],
    requiredIn: ['backend', 'api-gateway', 'terminal-gateway'],
    delivery: [D.K3S_SECRET, D.GITHUB_SECRET, D.WRANGLER_SECRET, D.PROCESS_ENV],
    rotation: 'rotate-on-credential-compromise-or-release',
    description: 'JWT signing and verification secret.',
  }),
  entry('BACKEND_KEY', {
    owner: 'platform-security',
    classification: C.SECRET,
    scopes: [S.BACKEND, S.API_GATEWAY],
    requiredIn: ['backend', 'api-gateway'],
    delivery: [D.K3S_SECRET, D.GITHUB_SECRET, D.WRANGLER_SECRET, D.PROCESS_ENV],
    rotation: 'rotate-on-credential-compromise-or-release',
    description: 'Shared Worker to backend authentication key.',
  }),
  entry('GATEWAY_SIGNING_SECRET', {
    owner: 'platform-security',
    classification: C.SECRET,
    scopes: [S.BACKEND, S.API_GATEWAY],
    requiredIn: ['backend', 'api-gateway'],
    delivery: [D.K3S_SECRET, D.GITHUB_SECRET, D.WRANGLER_SECRET, D.PROCESS_ENV],
    rotation: 'rotate-on-credential-compromise-or-release',
    deprecatedAliases: ['BACKEND_GATEWAY_SIGNING_SECRET'],
  }),
  entry('BACKEND_GATEWAY_SIGNING_SECRET', {
    owner: 'platform-security',
    classification: C.SECRET,
    scopes: [S.BACKEND, S.API_GATEWAY],
    delivery: [D.K3S_SECRET, D.GITHUB_SECRET, D.WRANGLER_SECRET, D.PROCESS_ENV],
    rotation: 'deprecated-alias',
    deprecatedAliases: ['GATEWAY_SIGNING_SECRET'],
  }),
  entry('INTERNAL_KEY', {
    owner: 'platform-security',
    classification: C.SECRET,
    scopes: [S.R2_GATEWAY],
    requiredIn: ['r2-gateway'],
    delivery: [D.GITHUB_SECRET, D.WRANGLER_SECRET],
    rotation: 'rotate-on-credential-compromise-or-release',
  }),
  entry('SECRETS_ENCRYPTION_KEY', {
    owner: 'worker-platform',
    classification: C.SECRET,
    scopes: [S.API_GATEWAY],
    requiredIn: ['api-gateway'],
    delivery: [D.GITHUB_SECRET, D.WRANGLER_SECRET],
    rotation: 'requires-d1-re-encryption-runbook',
  }),
  entry('TERMINAL_SESSION_SECRET', {
    owner: 'platform-security',
    classification: C.SECRET,
    scopes: [S.BACKEND, S.TERMINAL_GATEWAY, S.TERMINAL_SERVER, S.K3S],
    requiredIn: ['terminal-gateway', 'terminal-server'],
    delivery: [D.K3S_SECRET, D.GITHUB_SECRET, D.WRANGLER_SECRET, D.PROCESS_ENV],
    rotation: 'rotate-on-credential-compromise-or-release',
    description: 'HMAC signing secret for terminal admission and session tokens.',
  }),
  entry('BACKEND_ORIGIN', {
    owner: 'worker-platform',
    classification: C.PRIVATE_CONFIG,
    scopes: [S.API_GATEWAY],
    requiredIn: ['api-gateway'],
    delivery: [D.GITHUB_SECRET, D.WRANGLER_SECRET],
    rotation: 'not-secret',
  }),
];

const authAndAdmin = [
  entry('ADMIN_ALLOWED_EMAILS', {
    owner: 'identity-platform',
    classification: C.PRIVATE_CONFIG,
    scopes: [S.BACKEND, S.API_GATEWAY, S.K3S],
    requiredIn: ['backend:oauth-enabled', 'api-gateway:oauth-enabled'],
    delivery: [D.K3S_SECRET, D.GITHUB_SECRET, D.WRANGLER_SECRET, D.PROCESS_ENV],
    rotation: 'membership-change',
  }),
  ...entries(
    [
      'ADMIN_SETUP_TOKEN',
      'ADMIN_BEARER_TOKEN',
      'ADMIN_PASSWORD',
      'TOTP_SECRET',
      'GITHUB_CLIENT_SECRET',
      'GOOGLE_CLIENT_SECRET',
      'OPENCODE_AUTH_TOKEN',
    ],
    {
      owner: 'identity-platform',
      classification: C.SECRET,
      scopes: [S.BACKEND, S.API_GATEWAY, S.K3S],
      delivery: [D.K3S_SECRET, D.GITHUB_SECRET, D.WRANGLER_SECRET, D.PROCESS_ENV, D.D1_SECRET_VAULT],
      rotation: 'manual-with-audit',
    },
    {
      ADMIN_PASSWORD: { deprecatedAliases: ['ADMIN_USERNAME'], rotation: 'deprecated-local-only' },
      ADMIN_BEARER_TOKEN: { scopes: [S.BACKEND, S.K3S] },
      TOTP_SECRET: { scopes: [S.BACKEND, S.K3S] },
    },
  ),
  ...entries(['ADMIN_USERNAME', 'ADMIN_EMAIL', 'GITHUB_CLIENT_ID', 'GOOGLE_CLIENT_ID', 'OAUTH_REDIRECT_BASE_URL'], {
    owner: 'identity-platform',
    classification: C.PRIVATE_CONFIG,
    scopes: [S.BACKEND, S.API_GATEWAY, S.K3S],
    delivery: [D.K3S_SECRET, D.GITHUB_SECRET, D.WRANGLER_SECRET, D.PROCESS_ENV],
    rotation: 'not-secret',
  }),
  entry('SECRET_PLAINTEXT_ACCESS_ENABLED', {
    owner: 'security-operations',
    classification: C.PRIVATE_CONFIG,
    scopes: [S.API_GATEWAY],
    delivery: [D.WRANGLER_VAR],
    rotation: 'break-glass-window-only',
  }),
  entry('ADMIN_WORKER_MUTATIONS', {
    owner: 'identity-platform',
    classification: C.PRIVATE_CONFIG,
    scopes: [S.BACKEND],
    delivery: [D.PROCESS_ENV],
    rotation: 'not-secret',
    description: 'Local guard for backend worker-admin mutation routes.',
  }),
];

const aiKeys = [
  ...entries(
    [
      'AI_API_KEY',
      'OPENAI_API_KEY',
      'AI_IMAGE_PROXY_API_KEY',
      'AI_EMBEDDING_API_KEY',
      'PERPLEXITY_API_KEY',
      'TAVILY_API_KEY',
      'BRAVE_SEARCH_API_KEY',
      'SERPER_API_KEY',
      'GEMINI_API_KEY',
    ],
    {
      owner: 'ai-platform',
      classification: C.SECRET,
      scopes: [S.BACKEND, S.API_GATEWAY, S.K3S],
      delivery: [D.K3S_SECRET, D.GITHUB_SECRET, D.WRANGLER_SECRET, D.PROCESS_ENV, D.D1_SECRET_VAULT],
      rotation: 'provider-key-rotation',
    },
    {
      GEMINI_API_KEY: { rotation: 'deprecated-backend-managed' },
      OPENAI_API_KEY: { deprecatedAliases: ['AI_API_KEY'] },
    },
  ),
  ...entries(
    [
      'AI_SERVER_URL',
      'OPENAI_API_BASE_URL',
      'AI_IMAGE_PROXY_BASE_URL',
      'AI_EMBEDDING_URL',
      'AI_IMAGE_MODEL',
      'AI_IMAGE_TIMEOUT_MS',
      'AI_IMAGE_MAX_COUNT',
      'AI_IMAGE_MAX_PROMPT_LENGTH',
      'AI_IMAGE_MAX_OUTPUT_BYTES',
      'AI_IMAGE_STORAGE_SUBDIR',
      'AI_EMBED_MODEL',
      'PERPLEXITY_MODEL',
      'PERPLEXITY_API_URL',
      'TAVILY_API_URL',
      'BRAVE_SEARCH_URL',
      'SERPER_URL',
      'SEARCH_API_URL',
      'QUERY_EXPANDER_MODEL',
      'OPENAI_DEFAULT_MODEL',
    ],
    {
      owner: 'ai-platform',
      classification: C.PRIVATE_CONFIG,
      scopes: [S.BACKEND, S.API_GATEWAY, S.K3S],
      delivery: [D.PROCESS_ENV, D.K3S_CONFIGMAP, D.WRANGLER_VAR, D.KV_DYNAMIC_CONFIG],
      rotation: 'not-secret',
    },
    {
      AI_SERVER_URL: {
        classification: C.RUNTIME_MUTABLE_CONFIG,
        mutableAtRuntime: true,
        deprecatedAliases: ['OPENAI_API_BASE_URL', 'AI_SERVE_URL'],
      },
      OPENAI_API_BASE_URL: { deprecatedAliases: ['AI_SERVER_URL'], rotation: 'deprecated-alias' },
    },
  ),
];

const dataAndInfra = [
  ...entries(
    [
      'DATABASE_URL',
      'POSTGRES_PASSWORD',
      'REDIS_URL',
      'REDIS_PASSWORD',
      'SURREALDB_ROOT_PASSWORD',
      'CONTENT_GIT_REPO_AUTH',
      'GITHUB_TOKEN',
      'GITHUB_REPO_OWNER',
      'GITHUB_REPO_NAME',
      'GIT_USER_NAME',
      'GIT_USER_EMAIL',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'VERCEL_DEPLOY_HOOK_URL',
    ],
    {
      owner: 'infrastructure',
      classification: C.SECRET,
      scopes: [S.BACKEND, S.K3S, S.GITHUB_ACTIONS, S.INFRA, S.CONTENT_SYNC],
      delivery: [D.K3S_SECRET, D.GITHUB_SECRET, D.PROCESS_ENV],
      rotation: 'infrastructure-credential-rotation',
    },
    {
      CLOUDFLARE_ACCOUNT_ID: {
        classification: C.DEPLOYMENT_ONLY,
        publicExposure: false,
        rotation: 'not-secret-account-identifier',
      },
      GITHUB_TOKEN: { scopes: [S.BACKEND, S.GITHUB_ACTIONS, S.K3S] },
      GITHUB_REPO_OWNER: { classification: C.PRIVATE_CONFIG, rotation: 'not-secret' },
      GITHUB_REPO_NAME: { classification: C.PRIVATE_CONFIG, rotation: 'not-secret' },
      GIT_USER_NAME: { classification: C.PRIVATE_CONFIG, rotation: 'not-secret' },
      GIT_USER_EMAIL: { classification: C.PRIVATE_CONFIG, rotation: 'not-secret' },
    },
  ),
  ...entries(
    [
      'POSTGRES_DB',
      'POSTGRES_USER',
      'SQLITE_PATH',
      'SQLITE_MIGRATIONS_DIR',
      'CHROMA_URL',
      'CHROMA_COLLECTION',
      'CHROMA_DATABASE',
      'CHROMA_MEMORY_COLLECTION',
      'CHROMA_TENANT',
      'DB_PATH',
      'DB_TABLE_MEMORIES',
      'DB_TABLE_PREFERENCES',
      'CONTENT_GIT_REPO',
      'CONTENT_GIT_REF',
      'CONTENT_PUBLIC_DIR',
      'CONTENT_POSTS_DIR',
      'CONTENT_IMAGES_DIR',
      'REPO_ROOT',
      'POSTS_SOURCE',
      'OPEN_NOTEBOOK_URL',
      'OPEN_NOTEBOOK_ENABLED',
      'SANDBOX_IMAGE',
      'PISTON_URL',
      'WORKSPACE_PATH',
    ],
    {
      owner: 'infrastructure',
      classification: C.PRIVATE_CONFIG,
      scopes: [S.BACKEND, S.K3S, S.INFRA, S.OPEN_NOTEBOOK, S.CONTENT_SYNC],
      delivery: [D.K3S_CONFIGMAP, D.PROCESS_ENV],
      rotation: 'not-secret',
    },
  ),
];

const backendRuntime = entries(
  [
    'HOST',
    'PORT',
    'TRUST_PROXY',
    'LOG_LEVEL',
    'ALLOWED_ORIGINS',
    'ASSETS_BASE_URL',
    'RATE_LIMIT_MAX',
    'RATE_LIMIT_WINDOW_MS',
    'AI_ASYNC_MODE',
    'JWT_EXPIRES_IN',
    'ALLOW_INSECURE_DEV_AUTH',
    'INTERNAL_API_URL',
    'WORKER_API_URL',
    'CHAT_WS_ENABLED',
    'TERMINAL_SERVER_URL',
    'TERMINAL_CONNECT_TOKEN_TTL_SECONDS',
    'TERMINAL_SESSION_TIMEOUT_MS',
    'TERMINAL_BLOCKED_COUNTRIES',
    'ENABLE_LEGACY_BACKEND_AUTH',
    'USE_CONSUL',
    'CONSUL_HOST',
    'CONSUL_PORT',
    'CONSUL_PREFIX',
    'CONSUL_CACHE_TTL_MS',
    'READINESS_CHECK_TIMEOUT_MS',
    'SMOKE_BASE_URL',
    'SMOKE_TIMEOUT_MS',
  ],
  {
    owner: 'backend-platform',
    classification: C.PRIVATE_CONFIG,
    scopes: [S.BACKEND, S.K3S, S.CI],
    delivery: [D.PROCESS_ENV, D.K3S_CONFIGMAP, D.CONSUL_KV, D.DEFAULT],
    rotation: 'not-secret',
  },
  {
    ASSETS_BASE_URL: {
      publicExposure: true,
      publicExposureReason: 'Public base URL for static assets.',
      scopes: [S.BACKEND, S.API_GATEWAY, S.FRONTEND, S.K3S],
      delivery: [D.PROCESS_ENV, D.K3S_CONFIGMAP, D.WRANGLER_VAR, D.FRONTEND_RUNTIME_JSON],
    },
    ALLOWED_ORIGINS: {
      scopes: [S.BACKEND, S.API_GATEWAY, S.K3S],
      delivery: [D.PROCESS_ENV, D.K3S_CONFIGMAP, D.WRANGLER_VAR],
    },
    TERMINAL_CONNECT_TOKEN_TTL_SECONDS: {
      scopes: [S.BACKEND, S.TERMINAL_GATEWAY, S.TERMINAL_SERVER, S.K3S],
      delivery: [D.PROCESS_ENV, D.K3S_CONFIGMAP, D.WRANGLER_VAR],
    },
    TERMINAL_BLOCKED_COUNTRIES: {
      scopes: [S.BACKEND, S.TERMINAL_GATEWAY, S.K3S],
      delivery: [D.PROCESS_ENV, D.K3S_CONFIGMAP, D.WRANGLER_VAR],
    },
  },
);

const backendTuningKeys = entries(
  [
    'AGENT_MAX_CONTEXT_MESSAGES',
    'AGENT_MAX_TOOL_ITERATIONS',
    'AGENT_MEMORY_LIMIT',
    'AGENT_MEMORY_MIN_SCORE',
    'AGENT_MEMORY_TIMEOUT_MS',
    'AGENT_MODEL',
    'AGENT_STREAM_CHUNK_DELAY_MS',
    'AGENT_STREAM_CHUNK_SIZE',
    'AGENT_SYSTEM_PROMPT_TIMEOUT_MS',
    'AGENT_TOOL_TIMEOUT_MS',
    'AGENT_USER_PREFERENCE_TIMEOUT_MS',
    'AI_DLQ_ALARM_THRESHOLD',
    'AI_ENABLE_LEGACY_COMPLETIONS_FALLBACK',
    'AI_FALLBACK_MODELS',
    'AI_LEGACY_COMPLETIONS_MODEL',
    'AI_RATE_LIMIT_MAX',
    'AI_RATE_LIMIT_WINDOW_MS',
    'AI_REDIS_CHECK_TTL_MS',
    'AI_STATIC_MODEL_LIST',
    'AI_TASK_STREAM_MAXLEN',
    'AI_TASK_WAIT_TIMEOUT_MS',
    'AI_TEMP_AGGREGATE',
    'AI_TEMP_CATALYST',
    'AI_TEMP_CHAIN',
    'AI_TEMP_CUSTOM',
    'AI_TEMP_DEFAULT',
    'AI_TEMP_GENERATE',
    'AI_TEMP_PLAYGROUND',
    'AI_TEMP_PRISM',
    'AI_TEMP_QUIZ',
    'AI_TEMP_SKETCH',
    'AI_TEMP_SUMMARY',
    'AI_TEMP_TEMPLATE',
    'AI_WORKER_BATCH_SIZE',
    'AI_WORKER_BLOCK_TIME',
    'AI_WORKER_NAME',
    'BACKEND_DOMAIN_OUTBOX_ENABLED',
    'BACKEND_DOMAIN_OUTBOX_INTERVAL_MS',
    'BACKEND_STATE_MODE',
    'CHAT_IDEMPOTENCY_TTL_SECONDS',
    'CHAT_LIVE_CONTEXT_MESSAGES',
    'CHAT_NOTEBOOK_CONTEXT_TIMEOUT_MS',
    'CHAT_RAG_CONTEXT_TIMEOUT_MS',
    'CHAT_RESPONSE_TIMEOUT_MS',
    'CIRCUIT_BREAKER_RESET_MS',
    'CIRCUIT_BREAKER_THRESHOLD',
    'CODE_EXEC_TIMEOUT',
    'DEFAULT_ALLOWED_FAILS',
    'DEFAULT_CONVERSATION_TYPE',
    'DEFAULT_COOLDOWN_TIME',
    'DEFAULT_MEMORY_LIMIT',
    'DEFAULT_MEMORY_TYPE',
    'DEFAULT_MODEL_PRIORITY',
    'DEFAULT_NUM_RETRIES',
    'DEFAULT_PERSONA',
    'DEFAULT_ROUTING_STRATEGY',
    'DEFAULT_SEARCH_LIMIT',
    'DEFAULT_TIMEOUT_MS',
    'DEFAULT_TIMEOUT_SECONDS',
    'DISABLE_MCP',
    'FALLBACK_FACETS',
    'FALLBACK_MOOD',
    'FALLBACK_QUESTIONS',
    'FALLBACK_SEARCH_SCORE',
    'FALLBACK_SUMMARY_LENGTH',
    'HEALTH_CHECK_CACHE_TTL_MS',
    'HEALTH_CHECK_PROMPT',
    'HEALTH_CHECK_TIMEOUT_MS',
    'HEALTH_STATUS_UNKNOWN',
    'IMAGE_DEFAULT_MIME',
    'IMAGE_FETCH_TIMEOUT_MS',
    'IMAGE_MAX_SIZE_BYTES',
    'LIVE_AGENT_MAX_DELAY_MS',
    'LIVE_AGENT_MAX_REPLY_CHARS',
    'LIVE_AGENT_MIN_DELAY_MS',
    'LIVE_AGENT_SILENCE_PROBABILITY',
    'LIVE_AGENT_TEMPERATURE',
    'LIVE_CONFIG_KEY',
    'LIVE_CONTEXT_MAX_MESSAGES',
    'LIVE_CONTEXT_MAX_SESSIONS',
    'LIVE_CONTEXT_MAX_TEXT',
    'LIVE_REDIS_BRIDGE_BASE_RETRY_MS',
    'LIVE_REDIS_BRIDGE_MAX_RETRY_MS',
    'LIVE_REDIS_PRESENCE_TTL_SEC',
    'LIVE_RESEARCH_RAG_TIMEOUT_MS',
    'LIVE_RESEARCH_WEB_TIMEOUT_MS',
    'LONG_CONTEXT_THRESHOLD',
    'LONG_TIMEOUT_MS',
    'MAX_SESSION_HISTORY',
    'MCP_CONFIG_PATH',
    'MODEL_LIST_CACHE_TTL_MS',
    'MODEL_TEST_PROMPT',
    'MODEL_TEST_RESPONSE_LIMIT',
    'MODEL_TEST_TIMEOUT_MS',
    'OPENAI_MAX_RETRIES',
    'OPEN_NOTEBOOK_MODEL_CACHE_TTL_MS',
    'PERPLEXITY_RECENCY_FILTER',
    'RAG_BLOG_ASSISTANT_PROMPT',
    'RAG_CONTEXT_TEMPLATE',
    'RAG_DEFAULT_RESULTS',
    'RAG_KEYWORDS_ENGLISH',
    'RAG_KEYWORDS_KOREAN',
    'RAG_MIN_SCORE',
    'RAG_RECOMMENDATION_INSTRUCTION',
    'SEARCH_DEFAULT_ENGINE',
    'SEARCH_DEFAULT_LIMIT',
    'SESSION_CACHE_TTL_MS',
    'SESSION_CLEANUP_INTERVAL_MS',
    'SESSION_TTL',
    'SSE_PING_INTERVAL_MS',
    'STREAM_CHUNK_DELAY_MS',
    'STREAM_CHUNK_SIZE',
    'TAVILY_SEARCH_DEPTH',
    'TEXT_LIMIT_BULLET',
    'TEXT_LIMIT_FALLBACK',
    'TEXT_LIMIT_MEMORY',
    'TEXT_LIMIT_TASK_PARAGRAPH',
    'TEXT_LIMIT_TASK_TITLE',
    'TEXT_LIMIT_WEB_PAGE',
    'TOOL_TIMEOUT_MS',
    'TRANSLATE_PROXY_TIMEOUT_MS',
    'USAGE_DEFAULT_DAYS',
    'USAGE_DEFAULT_PERIOD_MS',
    'VALID_TASK_MODES',
    'VECTOR_SEARCH_DEFAULT_LIMIT',
    'VECTOR_SEARCH_MIN_SCORE',
    'VISION_DEFAULT_PROMPT',
    'WEB_SCRAPER_USER_AGENT',
    'WEB_SEARCH_ENGINE',
    'WS_STREAM_CHUNK_DELAY_MS',
    'WS_STREAM_CHUNK_SIZE',
  ],
  {
    owner: 'backend-platform',
    classification: C.PRIVATE_CONFIG,
    scopes: [S.BACKEND],
    delivery: [D.PROCESS_ENV, D.DEFAULT],
    rotation: 'not-secret',
  },
);

const workerOnly = entries(
  [
    'ENV',
    'CF_ACCESS_AUD',
    'CF_TEAM_DOMAIN',
    'AI_RATE_LIMIT_PER_MINUTE',
    'CHAT_RATE_LIMIT_PER_MINUTE',
    'AI_WARM_MAX_QUEUE_LENGTH',
    'AI_WARM_MAX_DLQ_LENGTH',
    'AI_WARM_SCAN_INTERVAL_MS',
    'NOTIFY_FROM_EMAIL',
    'NOTIFY_TO_EMAILS',
    'RESEND_API_KEY',
    'TERMINAL_ORIGIN',
    'GITHUB_PAGES_ORIGIN',
    'RAW_CONTENT_ORIGIN',
    'MY_BUCKET',
    'R2',
    'KV',
    'DB',
    'TEST_MIGRATIONS',
  ],
    {
      owner: 'worker-platform',
      classification: C.PRIVATE_CONFIG,
      scopes: [S.API_GATEWAY, S.TERMINAL_GATEWAY, S.R2_GATEWAY, S.SEO_GATEWAY],
      delivery: [D.WRANGLER_VAR],
      rotation: 'not-secret',
    },
    {
      RESEND_API_KEY: {
        classification: C.SECRET,
        scopes: [S.API_GATEWAY],
        delivery: [D.WRANGLER_SECRET, D.GITHUB_SECRET],
        rotation: 'provider-key-rotation',
      },
      OPENCODE_AUTH_TOKEN: { classification: C.SECRET },
      MY_BUCKET: { classification: C.INFRA_ONLY, scopes: [S.R2_GATEWAY, S.API_GATEWAY] },
    R2: { classification: C.INFRA_ONLY, scopes: [S.R2_GATEWAY, S.API_GATEWAY] },
    KV: { classification: C.INFRA_ONLY, scopes: [S.API_GATEWAY] },
    DB: { classification: C.INFRA_ONLY, scopes: [S.API_GATEWAY] },
    TEST_MIGRATIONS: { scopes: [S.API_GATEWAY, S.CI], delivery: [D.PROCESS_ENV] },
  },
);

const deprecatedOrDenied = [
  entry('VITE_CHAT_API_KEY', {
    owner: 'frontend-platform',
    classification: C.SECRET,
    scopes: [S.FRONTEND, S.GITHUB_ACTIONS],
    delivery: [D.GITHUB_SECRET, D.VITE_BUILD_VAR],
    publicExposure: false,
    rotation: 'deprecated-remove-from-browser',
    description: 'Deprecated browser-exposed chat API key path. Chat requests no longer use it.',
  }),
  entry('AI_SERVE_API_KEY', {
    owner: 'ai-platform',
    classification: C.SECRET,
    scopes: [S.API_GATEWAY],
    delivery: [D.D1_SECRET_VAULT, D.WRANGLER_SECRET],
    deprecatedAliases: ['AI_API_KEY'],
    rotation: 'deprecated-alias',
  }),
  entry('AI_SERVE_URL', {
    owner: 'ai-platform',
    classification: C.PRIVATE_CONFIG,
    scopes: [S.API_GATEWAY],
    delivery: [D.KV_DYNAMIC_CONFIG],
    deprecatedAliases: ['AI_SERVER_URL'],
    rotation: 'deprecated-alias',
  }),
];

export const CONFIG_REGISTRY = Object.freeze([
  ...publicRuntimeKeys,
  ...coreSecrets,
  ...authAndAdmin,
  ...aiKeys,
  ...dataAndInfra,
  ...backendRuntime,
  ...backendTuningKeys,
  ...workerOnly,
  ...deprecatedOrDenied,
]);

export function getConfigRegistryEntry(key) {
  return CONFIG_REGISTRY.find((item) => item.key === key) || null;
}

export function listConfigRegistry() {
  return [...CONFIG_REGISTRY];
}

export function listConfigRegistryByScope(scope) {
  return CONFIG_REGISTRY.filter((item) => item.scopes.includes(scope));
}

export function listPublicRuntimeConfigKeys() {
  return CONFIG_REGISTRY.filter((item) => item.publicExposure).map((item) => item.key);
}

export function listWorkerDynamicConfigEntries() {
  return CONFIG_REGISTRY.filter(
    (item) =>
      item.mutableAtRuntime &&
      item.classification !== C.SECRET &&
      item.delivery.includes(D.KV_DYNAMIC_CONFIG),
  );
}

export function listWorkerDynamicConfigKeys() {
  return listWorkerDynamicConfigEntries().map((item) => item.key);
}

export function isRuntimeMutableConfigKey(key) {
  return listWorkerDynamicConfigKeys().includes(key);
}

export function isSecretLikeConfigKey(key) {
  const entryForKey = getConfigRegistryEntry(key);
  if (entryForKey?.classification === C.SECRET) return true;
  return isSecretLikeKey(key);
}

export function isPlaceholderConfigValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return (
    normalized === '' ||
    normalized === 'replace-me' ||
    normalized === '<secret>' ||
    normalized === 'changeme' ||
    normalized === 'sk-placeholder' ||
    normalized.startsWith('replace-me-')
  );
}

export function isConfigEntryRequiredForService(entryForKey, service) {
  return entryForKey.requiredIn.includes(service);
}

export function listRequiredConfigEntries(service) {
  return CONFIG_REGISTRY.filter((entryForKey) =>
    isConfigEntryRequiredForService(entryForKey, service),
  );
}

export function evaluateRequiredConfig(service, source) {
  const sourceObject = source || {};
  return listRequiredConfigEntries(service).map((entryForKey) => {
    const value = sourceObject[entryForKey.key];
    const deprecatedAliasWithValue = entryForKey.deprecatedAliases.find((alias) => sourceObject[alias]);
    const sourceLabel = value
      ? 'canonical'
      : deprecatedAliasWithValue
        ? `deprecated-alias:${deprecatedAliasWithValue}`
        : 'missing';
    return {
      key: entryForKey.key,
      required: true,
      configured: Boolean(value || deprecatedAliasWithValue),
      placeholder: isPlaceholderConfigValue(value),
      source: sourceLabel,
      classification: entryForKey.classification,
    };
  });
}

export function validateConfigRegistry(registry = CONFIG_REGISTRY) {
  const errors = [];
  const seen = new Set();

  for (const item of registry) {
    if (!item.key) errors.push('registry entry missing key');
    if (seen.has(item.key)) errors.push(`duplicate registry key: ${item.key}`);
    seen.add(item.key);

    if (!item.owner) errors.push(`${item.key}: owner is required`);
    if (!CONFIG_CLASSIFICATION_VALUES.includes(item.classification)) {
      errors.push(`${item.key}: unknown classification ${item.classification}`);
    }
    if (!Array.isArray(item.scopes) || item.scopes.length === 0) {
      errors.push(`${item.key}: scopes must not be empty`);
    } else {
      for (const scope of item.scopes) {
        if (!CONFIG_SCOPE_VALUES.includes(scope)) errors.push(`${item.key}: unknown scope ${scope}`);
      }
    }
    if (!Array.isArray(item.delivery) || item.delivery.length === 0) {
      errors.push(`${item.key}: delivery must not be empty`);
    } else {
      for (const delivery of item.delivery) {
        if (!CONFIG_DELIVERY_VALUES.includes(delivery)) {
          errors.push(`${item.key}: unknown delivery ${delivery}`);
        }
      }
    }
    if (item.classification === C.SECRET && item.publicExposure) {
      errors.push(`${item.key}: secret cannot have publicExposure=true`);
    }
    if (item.mutableAtRuntime && item.classification === C.SECRET) {
      errors.push(`${item.key}: secrets cannot be mutable through runtime config`);
    }
    if (
      item.publicExposure &&
      isSecretLikeKey(item.key) &&
      !item.publicExposureReason
    ) {
      errors.push(`${item.key}: public secret-like key requires publicExposureReason`);
    }
    if (
      item.delivery.includes(D.KV_DYNAMIC_CONFIG) &&
      isSecretLikeKey(item.key) &&
      item.classification === C.SECRET
    ) {
      errors.push(`${item.key}: secret cannot be delivered through KV dynamic config`);
    }
  }

  return errors;
}

export function assertValidConfigRegistry(registry = CONFIG_REGISTRY) {
  const errors = validateConfigRegistry(registry);
  if (errors.length > 0) {
    throw new Error(`Config registry is invalid:\n${errors.join('\n')}`);
  }
}

assertValidConfigRegistry();
