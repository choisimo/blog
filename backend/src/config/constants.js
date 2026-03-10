/**
 * Configuration Constants
 *
 * Centralized configuration constants with environment variable support.
 * All hardcoded values are parameterized for GitHub Secrets compatibility.
 *
 * Environment Variable Conventions:
 * - Individual values: CATEGORY_NAME (e.g., AI_DEFAULT_MODEL)
 * - Arrays: JSON strings (e.g., AI_FALLBACK_MODELS='["gpt-4o","gpt-4.1"]')
 * - Nested objects: Underscore-separated (e.g., CIRCUIT_BREAKER_THRESHOLD)
 *
 * @module config/constants
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a JSON environment variable with fallback
 * @param {string} envVar - Environment variable value
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed value or default
 */
function parseJsonEnv(envVar, defaultValue) {
  if (!envVar) return defaultValue;
  try {
    return JSON.parse(envVar);
  } catch {
    return defaultValue;
  }
}

/**
 * Parse a number from environment variable with fallback
 * @param {string} envVar - Environment variable value
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number} Parsed number or default
 */
function parseIntEnv(envVar, defaultValue) {
  if (!envVar) return defaultValue;
  const parsed = parseInt(envVar, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Parse a float from environment variable with fallback
 * @param {string} envVar - Environment variable value
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number} Parsed float or default
 */
function parseFloatEnv(envVar, defaultValue) {
  if (!envVar) return defaultValue;
  const parsed = parseFloat(envVar);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Parse a boolean from environment variable
 * @param {string} envVar - Environment variable value
 * @param {boolean} defaultValue - Default value
 * @returns {boolean} Parsed boolean or default
 */
function parseBoolEnv(envVar, defaultValue) {
  if (envVar === undefined || envVar === null || envVar === '') return defaultValue;
  return envVar === 'true' || envVar === '1';
}

// ============================================================================
// AI Models Configuration
// ============================================================================

/**
 * AI model identifiers and defaults
 * @constant
 */
export const AI_MODELS = {
  /** Default model for general AI operations */
  DEFAULT: process.env.AI_DEFAULT_MODEL,

  /** Default model for agent operations */
  AGENT: process.env.AGENT_MODEL || process.env.AI_DEFAULT_MODEL,

  /** Default model for vision/image analysis */
  VISION: process.env.AI_VISION_MODEL,

  /** Default model for embeddings */
  EMBEDDING: process.env.AI_EMBED_MODEL,

  /** Model for Perplexity AI search */
  PERPLEXITY: process.env.PERPLEXITY_MODEL,

  /** Fallback models when primary is unavailable (JSON array) */
  FALLBACKS: parseJsonEnv(process.env.AI_FALLBACK_MODELS),

  /** Static fallback model list for when DB is unavailable */
  STATIC_FALLBACK_LIST: parseJsonEnv(process.env.AI_STATIC_MODEL_LIST),
};

// ============================================================================
// AI API Configuration
// ============================================================================

/**
 * AI API endpoint configuration
 * @constant
 */
export const AI_API = {
  /** Base URL for OpenAI-compatible API */
  BASE_URL: process.env.AI_SERVER_URL
    || process.env.OPENAI_API_BASE_URL,

  /** Embedding API base URL (falls back to main API) */
  EMBEDDING_URL: process.env.AI_EMBEDDING_URL
    || process.env.AI_SERVER_URL
    || process.env.OPENAI_API_BASE_URL,

  /** DuckDuckGo search API URL */
  DUCKDUCKGO_URL: process.env.SEARCH_API_URL,

  /** Perplexity API URL */
  PERPLEXITY_URL: process.env.PERPLEXITY_API_URL,

  /** Tavily API URL */
  TAVILY_URL: process.env.TAVILY_API_URL,

  /** Brave Search API URL */
  BRAVE_SEARCH_URL: process.env.BRAVE_SEARCH_URL,

  /** Serper (Google) API URL */
  SERPER_URL: process.env.SERPER_URL,
};

// ============================================================================
// Timeouts Configuration
// ============================================================================

/**
 * Timeout values in milliseconds
 * @constant
 */
export const TIMEOUTS = {
  /** Default HTTP request timeout */
  DEFAULT: parseIntEnv(process.env.DEFAULT_TIMEOUT_MS, 120_000), // 2 minutes

  /** Long-running operations timeout */
  LONG: parseIntEnv(process.env.LONG_TIMEOUT_MS, 300_000), // 5 minutes

  /** Tool execution timeout */
  TOOL: parseIntEnv(process.env.TOOL_TIMEOUT_MS, 30_000), // 30 seconds

  /** Image fetch timeout */
  IMAGE_FETCH: parseIntEnv(process.env.IMAGE_FETCH_TIMEOUT_MS, 5_000), // 5 seconds

  /** Async AI task wait timeout */
  AI_TASK_WAIT: parseIntEnv(process.env.AI_TASK_WAIT_TIMEOUT_MS, 120_000), // 2 minutes

  /** SSE ping interval */
  SSE_PING: parseIntEnv(process.env.SSE_PING_INTERVAL_MS, 25_000), // 25 seconds

  /** Worker batch processing block time */
  WORKER_BLOCK: parseIntEnv(process.env.AI_WORKER_BLOCK_TIME, 5_000), // 5 seconds
};

// ============================================================================
// Circuit Breaker Configuration
// ============================================================================

/**
 * Circuit breaker settings for external service calls
 * @constant
 */
export const CIRCUIT_BREAKER = {
  /** Number of failures before opening circuit */
  THRESHOLD: parseIntEnv(process.env.CIRCUIT_BREAKER_THRESHOLD, 5),

  /** Time before attempting to close circuit (ms) */
  RESET_TIME: parseIntEnv(process.env.CIRCUIT_BREAKER_RESET_MS, 30_000), // 30 seconds
};

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

/**
 * Rate limiting configuration
 * @constant
 */
export const RATE_LIMIT = {
  /** Default rate limit window (ms) */
  WINDOW_MS: parseIntEnv(process.env.RATE_LIMIT_WINDOW_MS, 60_000), // 1 minute

  /** Default max requests per window */
  MAX: parseIntEnv(process.env.RATE_LIMIT_MAX, 60),

  /** AI-specific rate limit window (ms) */
  AI_WINDOW_MS: parseIntEnv(process.env.AI_RATE_LIMIT_WINDOW_MS, 60_000),

  /** AI-specific max requests per window */
  AI_MAX: parseIntEnv(process.env.AI_RATE_LIMIT_MAX, 30),
};

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Cache TTL values in milliseconds
 * @constant
 */
export const CACHE_TTL = {
  /** Consul KV cache TTL */
  CONSUL: parseIntEnv(process.env.CONSUL_CACHE_TTL_MS, 30_000), // 30 seconds

  /** Health check cache TTL */
  HEALTH_CHECK: parseIntEnv(process.env.HEALTH_CHECK_CACHE_TTL_MS, 10_000), // 10 seconds

  /** Model list cache TTL */
  MODEL_LIST: parseIntEnv(process.env.MODEL_LIST_CACHE_TTL_MS, 60_000), // 1 minute

  /** Session cache TTL */
  SESSION: parseIntEnv(process.env.SESSION_CACHE_TTL_MS, 300_000), // 5 minutes
};

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Agent coordinator settings
 * @constant
 */
export const AGENT = {
  /** Maximum tool execution iterations per request */
  MAX_TOOL_ITERATIONS: parseIntEnv(process.env.AGENT_MAX_TOOL_ITERATIONS, 10),

  /** Maximum context messages to include */
  MAX_CONTEXT_MESSAGES: parseIntEnv(process.env.AGENT_MAX_CONTEXT_MESSAGES, 20),

  /** Minimum relevance score for memory retrieval */
  MEMORY_MIN_SCORE: parseFloatEnv(process.env.AGENT_MEMORY_MIN_SCORE, 0.7),

  /** Maximum memories to retrieve */
  MEMORY_LIMIT: parseIntEnv(process.env.AGENT_MEMORY_LIMIT, 5),

  /** Streaming chunk size (characters) */
  STREAM_CHUNK_SIZE: parseIntEnv(process.env.AGENT_STREAM_CHUNK_SIZE, 40),

  /** Streaming chunk delay (ms) */
  STREAM_CHUNK_DELAY: parseIntEnv(process.env.AGENT_STREAM_CHUNK_DELAY_MS, 15),
};

// ============================================================================
// AI Task Temperatures
// ============================================================================

/**
 * Default temperature values for different AI tasks
 * @constant
 */
export const AI_TEMPERATURES = {
  /** Default temperature for general operations */
  DEFAULT: parseFloatEnv(process.env.AI_TEMP_DEFAULT, 0.7),

  /** Temperature for sketch task */
  SKETCH: parseFloatEnv(process.env.AI_TEMP_SKETCH, 0.3),

  /** Temperature for prism task */
  PRISM: parseFloatEnv(process.env.AI_TEMP_PRISM, 0.2),

  /** Temperature for chain task */
  CHAIN: parseFloatEnv(process.env.AI_TEMP_CHAIN, 0.2),

  /** Temperature for summary task */
  SUMMARY: parseFloatEnv(process.env.AI_TEMP_SUMMARY, 0.2),

  /** Temperature for generation */
  GENERATE: parseFloatEnv(process.env.AI_TEMP_GENERATE, 0.2),
};

// ============================================================================
// Text Processing Limits
// ============================================================================

/**
 * Text processing limits
 * @constant
 */
export const TEXT_LIMITS = {
  /** Maximum paragraph length for tasks */
  TASK_PARAGRAPH: parseIntEnv(process.env.TEXT_LIMIT_TASK_PARAGRAPH, 1600),

  /** Maximum title length for tasks */
  TASK_TITLE: parseIntEnv(process.env.TEXT_LIMIT_TASK_TITLE, 120),

  /** Maximum fallback text length */
  FALLBACK_TEXT: parseIntEnv(process.env.TEXT_LIMIT_FALLBACK, 200),

  /** Maximum bullet text length */
  BULLET_TEXT: parseIntEnv(process.env.TEXT_LIMIT_BULLET, 140),

  /** Maximum web page content length */
  WEB_PAGE_CONTENT: parseIntEnv(process.env.TEXT_LIMIT_WEB_PAGE, 5000),

  /** Maximum conversation content to save */
  MEMORY_CONTENT: parseIntEnv(process.env.TEXT_LIMIT_MEMORY, 500),
};

// ============================================================================
// Search Configuration
// ============================================================================

/**
 * Search-related configuration
 * @constant
 */
export const SEARCH = {
  /** Default number of search results */
  DEFAULT_LIMIT: parseIntEnv(process.env.SEARCH_DEFAULT_LIMIT, 5),

  /** Default search engine */
  DEFAULT_ENGINE: process.env.SEARCH_DEFAULT_ENGINE || 'tavily',

  /** Tavily default search depth */
  TAVILY_DEPTH: process.env.TAVILY_SEARCH_DEPTH || 'advanced',

  /** Perplexity default recency filter */
  PERPLEXITY_RECENCY: process.env.PERPLEXITY_RECENCY_FILTER || 'month',

  /** RAG default results count */
  RAG_DEFAULT_RESULTS: parseIntEnv(process.env.RAG_DEFAULT_RESULTS, 5),

  /** Minimum RAG relevance score */
  RAG_MIN_SCORE: parseFloatEnv(process.env.RAG_MIN_SCORE, 0.5),
};

// ============================================================================
// Image Processing Configuration
// ============================================================================

/**
 * Image processing settings
 * @constant
 */
export const IMAGE = {
  /** Maximum image upload size (bytes) */
  MAX_SIZE: parseIntEnv(process.env.IMAGE_MAX_SIZE_BYTES, 10 * 1024 * 1024), // 10MB

  /** Default MIME type */
  DEFAULT_MIME: process.env.IMAGE_DEFAULT_MIME || 'image/jpeg',

  /** Web scraper user agent */
  USER_AGENT: process.env.WEB_SCRAPER_USER_AGENT || 'Mozilla/5.0 (compatible; BlogAgent/1.0)',
};

// ============================================================================
// Worker Configuration
// ============================================================================

/**
 * Background worker settings
 * @constant
 */
export const WORKER = {
  /** Worker instance name */
  NAME: process.env.AI_WORKER_NAME || 'worker-1',

  /** Batch size for processing */
  BATCH_SIZE: parseIntEnv(process.env.AI_WORKER_BATCH_SIZE, 1),

  /** Block time for queue polling (ms) */
  BLOCK_TIME: parseIntEnv(process.env.AI_WORKER_BLOCK_TIME, 5000),
};

// ============================================================================
// Consul Service Discovery
// ============================================================================

/**
 * Consul configuration
 * @constant
 */
export const CONSUL = {
  /** Enable Consul service discovery */
  ENABLED: parseBoolEnv(process.env.USE_CONSUL, false),

  /** Consul host */
  HOST: process.env.CONSUL_HOST || 'consul',

  /** Consul port */
  PORT: parseIntEnv(process.env.CONSUL_PORT, 8500),

  /** Config key prefix */
  PREFIX: process.env.CONSUL_PREFIX || 'blog',
};

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Feature flag defaults
 * @constant
 */
export const FEATURES = {
  /** AI service enabled */
  AI_ENABLED: parseBoolEnv(process.env.FEATURE_AI_ENABLED, true),

  /** RAG search enabled */
  RAG_ENABLED: parseBoolEnv(process.env.FEATURE_RAG_ENABLED, true),

  /** Terminal service enabled */
  TERMINAL_ENABLED: parseBoolEnv(process.env.FEATURE_TERMINAL_ENABLED, true),

  /** Inline AI features enabled */
  AI_INLINE: parseBoolEnv(process.env.FEATURE_AI_INLINE, true),

  /** Comments enabled */
  COMMENTS_ENABLED: parseBoolEnv(process.env.FEATURE_COMMENTS_ENABLED, true),
};

// ============================================================================
// Server Configuration
// ============================================================================

/**
 * Server defaults
 * @constant
 */
export const SERVER = {
  /** Default host */
  HOST: process.env.HOST || '0.0.0.0',

  /** Default port */
  PORT: parseIntEnv(process.env.PORT, 5080),

  /** Trust proxy level */
  TRUST_PROXY: parseIntEnv(process.env.TRUST_PROXY, 1),

  /** Log level */
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  /** Application environment */
  ENV: process.env.APP_ENV || 'development',
};

// ============================================================================
// JWT Configuration
// ============================================================================

/**
 * JWT settings
 * @constant
 */
export const JWT = {
  /** Token expiration */
  EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',
};

// ============================================================================
// Content Configuration
// ============================================================================

/**
 * Content source settings
 * @constant
 */
export const CONTENT = {
  /** Posts source type */
  SOURCE: process.env.POSTS_SOURCE || 'filesystem',
};

// ============================================================================
// ChromaDB Configuration
// ============================================================================

/**
 * ChromaDB vector database settings
 * @constant
 */
export const CHROMA = {
  /** ChromaDB server URL */
  URL: process.env.CHROMA_URL || 'http://chromadb:8000',

  /** ChromaDB tenant name */
  TENANT: process.env.CHROMA_TENANT || 'default_tenant',

  /** ChromaDB database name */
  DATABASE: process.env.CHROMA_DATABASE || 'default_database',

  /** Collection name for blog posts */
  COLLECTION: process.env.CHROMA_COLLECTION || 'blog-posts-all-MiniLM-L6-v2',

  /** Collection name for agent memories */
  MEMORY_COLLECTION: process.env.CHROMA_MEMORY_COLLECTION || 'agent_memories',
};

// ============================================================================
// Session Configuration
// ============================================================================

/**
 * Session management settings
 * @constant
 */
export const SESSION = {
  /** Maximum session history length */
  MAX_HISTORY: parseIntEnv(process.env.MAX_SESSION_HISTORY, 100),

  /** Session TTL in milliseconds */
  TTL: parseIntEnv(process.env.SESSION_TTL, 3600000), // 1 hour

  /** Session cleanup interval in milliseconds */
  CLEANUP_INTERVAL: parseIntEnv(process.env.SESSION_CLEANUP_INTERVAL_MS, 60000), // 1 minute
};

// ============================================================================
// Database Table Names
// ============================================================================

/**
 * Database table names
 * @constant
 */
export const DB_TABLES = {
  /** Agent memories table */
  MEMORIES: process.env.DB_TABLE_MEMORIES || 'agent_memories',

  /** User preferences table */
  PREFERENCES: process.env.DB_TABLE_PREFERENCES || 'agent_user_preferences',
};

// ============================================================================
// AI Route Defaults
// ============================================================================

/**
 * Default values for AI routing configuration
 * @constant
 */
export const AI_ROUTE_DEFAULTS = {
  /** Default routing strategy */
  ROUTING_STRATEGY: process.env.DEFAULT_ROUTING_STRATEGY || 'latency-based-routing',

  /** Default number of retries */
  NUM_RETRIES: parseIntEnv(process.env.DEFAULT_NUM_RETRIES, 3),

  /** Default timeout in seconds */
  TIMEOUT_SECONDS: parseIntEnv(process.env.DEFAULT_TIMEOUT_SECONDS, 120),

  /** Default model priority */
  MODEL_PRIORITY: parseIntEnv(process.env.DEFAULT_MODEL_PRIORITY, 0),

  /** Default allowed failures before circuit break */
  ALLOWED_FAILS: parseIntEnv(process.env.DEFAULT_ALLOWED_FAILS, 3),

  /** Default cooldown time in seconds */
  COOLDOWN_TIME: parseIntEnv(process.env.DEFAULT_COOLDOWN_TIME, 60),
};

// ============================================================================
// Health Check Configuration
// ============================================================================

/**
 * Health check settings
 * @constant
 */
export const HEALTH_CHECK = {
  /** Default health status when unknown */
  STATUS_UNKNOWN: process.env.HEALTH_STATUS_UNKNOWN || 'unknown',

  /** Health check test prompt */
  PROMPT: process.env.HEALTH_CHECK_PROMPT || 'Hello',

  /** Health check timeout in milliseconds */
  TIMEOUT: parseIntEnv(process.env.HEALTH_CHECK_TIMEOUT_MS, 10000),

  /** Model test prompt */
  MODEL_TEST_PROMPT: process.env.MODEL_TEST_PROMPT || 'Say "Hello" in one word.',

  /** Model test timeout in milliseconds */
  MODEL_TEST_TIMEOUT: parseIntEnv(process.env.MODEL_TEST_TIMEOUT_MS, 30000),

  /** Model test response truncation limit */
  RESPONSE_LIMIT: parseIntEnv(process.env.MODEL_TEST_RESPONSE_LIMIT, 500),
};

// ============================================================================
// Streaming Configuration
// ============================================================================

/**
 * Streaming chunk settings
 * @constant
 */
export const STREAMING = {
  /** SSE/HTTP streaming chunk size */
  CHUNK_SIZE: parseIntEnv(process.env.STREAM_CHUNK_SIZE, 50),

  /** SSE/HTTP streaming chunk delay in milliseconds */
  CHUNK_DELAY: parseIntEnv(process.env.STREAM_CHUNK_DELAY_MS, 20),

  /** WebSocket streaming chunk size */
  WS_CHUNK_SIZE: parseIntEnv(process.env.WS_STREAM_CHUNK_SIZE, 50),

  /** WebSocket streaming chunk delay in milliseconds */
  WS_CHUNK_DELAY: parseIntEnv(process.env.WS_STREAM_CHUNK_DELAY_MS, 20),
};

// ============================================================================
// AI Task Valid Modes
// ============================================================================

/**
 * Valid AI task modes
 * @constant
 */
export const VALID_TASK_MODES = parseJsonEnv(
  process.env.VALID_TASK_MODES,
  ['sketch', 'prism', 'chain', 'catalyst', 'summary', 'custom', 'quiz']
);

// ============================================================================
// Fallback Data Configuration
// ============================================================================

/**
 * Fallback data for when AI tasks fail
 * @constant
 */
export const FALLBACK_DATA = {
  /** Default mood for sketch fallback */
  MOOD: process.env.FALLBACK_MOOD || 'curious',

  /** Default persona */
  PERSONA: process.env.DEFAULT_PERSONA || 'default',

  /** Fallback summary truncation length */
  SUMMARY_LENGTH: parseIntEnv(process.env.FALLBACK_SUMMARY_LENGTH, 300),

  /** Fallback relevance score for search */
  SEARCH_SCORE: parseFloatEnv(process.env.FALLBACK_SEARCH_SCORE, 0.8),

  /** Fallback facets for prism task (Korean) */
  FACETS: parseJsonEnv(process.env.FALLBACK_FACETS, [
    { title: '핵심 요점', points: ['내용을 분석할 수 없습니다.'] },
    { title: '생각해볼 점', points: ['다양한 관점에서 검토 필요', '추가 맥락 확인 권장'] },
  ]),

  /** Fallback questions for chain task (Korean) */
  QUESTIONS: parseJsonEnv(process.env.FALLBACK_QUESTIONS, [
    { q: '이 주장의 핵심 근거는 무엇인가?', why: '논리적 기반 확인' },
    { q: '어떤 전제나 가정이 깔려 있는가?', why: '숨겨진 전제 파악' },
    { q: '실제로 어떻게 적용할 수 있는가?', why: '실용적 가치 탐색' },
  ]),
};

// ============================================================================
// Memory Repository Configuration
// ============================================================================

/**
 * Memory repository settings
 * @constant
 */
export const MEMORY = {
  /** Default memory type */
  DEFAULT_TYPE: process.env.DEFAULT_MEMORY_TYPE || 'note',

  /** Default conversation memory type */
  CONVERSATION_TYPE: process.env.DEFAULT_CONVERSATION_TYPE || 'conversation',

  /** Default memory query limit */
  DEFAULT_LIMIT: parseIntEnv(process.env.DEFAULT_MEMORY_LIMIT, 50),

  /** Default search limit */
  SEARCH_LIMIT: parseIntEnv(process.env.DEFAULT_SEARCH_LIMIT, 20),

  /** Vector search default limit */
  VECTOR_SEARCH_LIMIT: parseIntEnv(process.env.VECTOR_SEARCH_DEFAULT_LIMIT, 5),

  /** Minimum relevance score for vector search */
  VECTOR_MIN_SCORE: parseFloatEnv(process.env.VECTOR_SEARCH_MIN_SCORE, 0.5),
};

// ============================================================================
// Long Context Configuration
// ============================================================================

/**
 * Context window thresholds
 * @constant
 */
export const CONTEXT = {
  /** Threshold for "long-context" capability (tokens) */
  LONG_THRESHOLD: parseIntEnv(process.env.LONG_CONTEXT_THRESHOLD, 100000),
};

// ============================================================================
// Usage Tracking Configuration
// ============================================================================

/**
 * Usage tracking settings
 * @constant
 */
export const USAGE = {
  /** Default usage tracking period in days */
  DEFAULT_DAYS: parseIntEnv(process.env.USAGE_DEFAULT_DAYS, 7),

  /** Default usage period in milliseconds (7 days) */
  DEFAULT_PERIOD_MS: parseIntEnv(process.env.USAGE_DEFAULT_PERIOD_MS, 7 * 24 * 60 * 60 * 1000),
};

// ============================================================================
// OpenAI Client Configuration
// ============================================================================

/**
 * OpenAI client settings
 * @constant
 */
export const OPENAI_CLIENT = {
  /** Maximum retries for OpenAI API calls */
  MAX_RETRIES: parseIntEnv(process.env.OPENAI_MAX_RETRIES, 2),

  /** Query expander model */
  QUERY_EXPANDER_MODEL: process.env.QUERY_EXPANDER_MODEL || 'gpt-4.1-mini',
};

// ============================================================================
// AI Temperatures (Extended)
// ============================================================================

// Add catalyst and custom temperatures to existing AI_TEMPERATURES
AI_TEMPERATURES.CATALYST = parseFloatEnv(process.env.AI_TEMP_CATALYST, 0.4);
AI_TEMPERATURES.CUSTOM = parseFloatEnv(process.env.AI_TEMP_CUSTOM, 0.2);
AI_TEMPERATURES.QUIZ = parseFloatEnv(process.env.AI_TEMP_QUIZ, 0.5);
AI_TEMPERATURES.PLAYGROUND = parseFloatEnv(process.env.AI_TEMP_PLAYGROUND, 0.7);
AI_TEMPERATURES.TEMPLATE = parseFloatEnv(process.env.AI_TEMP_TEMPLATE, 0.7);
AI_TEMPERATURES.AGGREGATE = parseFloatEnv(process.env.AI_TEMP_AGGREGATE, 0.2);

// ============================================================================
// RAG Prompts (for RAG context injection)
// ============================================================================

/**
 * RAG-related prompts and templates
 * @constant
 */
export const RAG_PROMPTS = {
  /** System prompt for blog assistant */
  BLOG_ASSISTANT: process.env.RAG_BLOG_ASSISTANT_PROMPT
    || '당신은 nodove 블로그의 AI 어시스턴트입니다. 사용자의 질문에 친절하게 답변해주세요.',

  /** Context template for RAG results */
  CONTEXT_TEMPLATE: process.env.RAG_CONTEXT_TEMPLATE
    || '아래는 사용자의 질문과 관련된 블로그 게시글 목록입니다. 이 정보를 바탕으로 답변해주세요:',

  /** Recommendation instruction */
  RECOMMENDATION_INSTRUCTION: process.env.RAG_RECOMMENDATION_INSTRUCTION
    || '위 게시글들을 참고하여 사용자에게 적절한 게시글을 추천해주세요. 제목, URL, 간단한 설명을 포함하여 안내해주세요.',
};

// ============================================================================
// Vision Prompts
// ============================================================================

/**
 * Vision analysis prompts
 * @constant
 */
export const VISION_PROMPTS = {
  /** Default vision analysis prompt */
  DEFAULT: process.env.VISION_DEFAULT_PROMPT || `이 이미지를 분석해주세요. 다음 내용을 간결하게 설명해주세요:
1. 이미지에 보이는 주요 요소들
2. 전체적인 분위기나 맥락
3. 텍스트가 있다면 해당 내용

한국어로 2-3문장으로 간결하게 요약해주세요.`,
};

// ============================================================================
// RAG Keywords (for detecting when to use RAG)
// ============================================================================

/**
 * Keywords for RAG trigger detection
 * @constant
 */
export const RAG_KEYWORDS = {
  /** Korean keywords that trigger RAG search */
  KOREAN: parseJsonEnv(process.env.RAG_KEYWORDS_KOREAN, [
    '게시글', '포스트', '글', '추천', '관련', '찾아', '알려', '보여',
    '블로그', '게시물', '작성', '읽', '검색', '주제',
  ]),

  /** English keywords that trigger RAG search */
  ENGLISH: parseJsonEnv(process.env.RAG_KEYWORDS_ENGLISH, [
    'post', 'blog', 'article', 'recommend', 'find', 'search',
    'show me', 'related', 'about', 'topic', 'written',
  ]),
};

// ============================================================================
// Default Export
// ============================================================================

/**
 * All constants as a single object for convenient access
 */
export default {
  AI_MODELS,
  AI_API,
  TIMEOUTS,
  CIRCUIT_BREAKER,
  RATE_LIMIT,
  CACHE_TTL,
  AGENT,
  AI_TEMPERATURES,
  TEXT_LIMITS,
  SEARCH,
  IMAGE,
  WORKER,
  CONSUL,
  FEATURES,
  SERVER,
  JWT,
  CONTENT,
  RAG_PROMPTS,
  VISION_PROMPTS,
  RAG_KEYWORDS,
  CHROMA,
  SESSION,
  DB_TABLES,
  AI_ROUTE_DEFAULTS,
  HEALTH_CHECK,
  STREAMING,
  VALID_TASK_MODES,
  FALLBACK_DATA,
  MEMORY,
  CONTEXT,
  USAGE,
  OPENAI_CLIENT,
};
