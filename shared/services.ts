/**
 * Centralized Service Configuration
 * 
 * 모든 서비스 엔드포인트, 포트, 명칭을 중앙에서 관리합니다.
 * 하드코딩된 연결 정보를 제거하고 환경변수로 오버라이드 가능하게 합니다.
 * 
 * 원칙:
 * 1. 모든 서비스 주소는 이 파일에서만 정의
 * 2. 환경변수로 오버라이드 가능
 * 3. 서비스 이름은 통일된 명명 규칙 사용
 */

// ============================================================================
// Environment Variable Helpers
// ============================================================================

function getEnv(key: string, defaultValue: string): string {
  const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  if (env) return env[key] || defaultValue;
  return defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = getEnv(key, String(defaultValue));
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// Service Names (통일된 명명 규칙)
// ============================================================================
// 기존: vas-core, opencode, opencode-serve 등 혼용
// 통일: 모든 서비스는 단일 명칭 사용

export const SERVICE_NAMES = {
  // AI Services
  AI_ENGINE: 'ai-engine',       // VAS Core (GitHub Copilot Auth) - 기존 vas-core/opencode 통일
  AI_ADMIN: 'ai-admin',         // VAS Admin UI - 기존 vas-admin
  
  // Backend Services  
  API: 'api',                   // Backend API Server
  
  // Infrastructure
  EMBEDDING: 'embedding',       // TEI Embedding Server
  VECTOR_DB: 'vector-db',       // ChromaDB
  TERMINAL: 'terminal',         // Terminal WebSocket Server
  
  // External
  NGINX: 'nginx',               // Reverse Proxy
} as const;

// ============================================================================
// Port Definitions (중앙 관리)
// ============================================================================

export const PORTS = {
  // AI Services
  AI_ENGINE: getEnvNumber('PORT_AI_ENGINE', 7012),
  AI_ADMIN: getEnvNumber('PORT_AI_ADMIN', 7080),
  
  // Backend Services
  API: getEnvNumber('PORT_API', 5080),
  
  // Infrastructure
  EMBEDDING: getEnvNumber('PORT_EMBEDDING', 80),
  VECTOR_DB: getEnvNumber('PORT_VECTOR_DB', 8000),
  TERMINAL: getEnvNumber('PORT_TERMINAL', 8080),
  
  // External
  NGINX: getEnvNumber('PORT_NGINX', 80),
  
  // Local Development (localhost binding)
  LOCAL_AI_ENGINE: getEnvNumber('PORT_LOCAL_AI_ENGINE', 7012),
  LOCAL_EMBEDDING: getEnvNumber('PORT_LOCAL_EMBEDDING', 8180),
  LOCAL_VECTOR_DB: getEnvNumber('PORT_LOCAL_VECTOR_DB', 8100),
} as const;

// ============================================================================
// Service URLs (환경별 자동 구성)
// ============================================================================

export interface ServiceEndpoint {
  name: string;
  host: string;
  port: number;
  url: string;
  healthPath: string;
}

function createEndpoint(
  name: string,
  envKey: string,
  defaultHost: string,
  port: number,
  healthPath = '/health'
): ServiceEndpoint {
  const host = getEnv(envKey, defaultHost);
  return {
    name,
    host,
    port,
    url: `http://${host}:${port}`,
    healthPath,
  };
}

// Docker 내부 서비스 엔드포인트
export const SERVICES = {
  // AI Engine (VAS Core) - GitHub Copilot authentication
  AI_ENGINE: createEndpoint(
    SERVICE_NAMES.AI_ENGINE,
    'SERVICE_AI_ENGINE_HOST',
    'ai-engine',  // 통일된 이름 (docker-compose에서 alias 사용)
    PORTS.AI_ENGINE,
    '/app'
  ),
  
  // AI Admin (VAS Admin)
  AI_ADMIN: createEndpoint(
    SERVICE_NAMES.AI_ADMIN,
    'SERVICE_AI_ADMIN_HOST',
    'ai-admin',
    PORTS.AI_ADMIN,
    '/health'
  ),
  
  // Backend API
  API: createEndpoint(
    SERVICE_NAMES.API,
    'SERVICE_API_HOST',
    'api',
    PORTS.API,
    '/api/v1/healthz'
  ),
  
  // Embedding Server (TEI)
  EMBEDDING: createEndpoint(
    SERVICE_NAMES.EMBEDDING,
    'SERVICE_EMBEDDING_HOST',
    'embedding-server',
    PORTS.EMBEDDING,
    '/health'
  ),
  
  // Vector Database (ChromaDB)
  VECTOR_DB: createEndpoint(
    SERVICE_NAMES.VECTOR_DB,
    'SERVICE_VECTOR_DB_HOST',
    'chromadb',
    PORTS.VECTOR_DB,
    '/api/v1/heartbeat'
  ),
  
  // Terminal Server
  TERMINAL: createEndpoint(
    SERVICE_NAMES.TERMINAL,
    'SERVICE_TERMINAL_HOST',
    'terminal-server',
    PORTS.TERMINAL,
    '/health'
  ),
} as const;

// ============================================================================
// URL Builders (OpenAI 호환 API 경로 등)
// ============================================================================

export const URLS = {
  // AI Engine (for auth only)
  aiEngine: {
    base: getEnv('AI_ENGINE_URL', SERVICES.AI_ENGINE.url),
    providers: () => `${URLS.aiEngine.base}/config/providers`,
    auth: () => `${URLS.aiEngine.base}/auth`,
  },
  
  // Backend API
  api: {
    base: getEnv('API_BASE_URL', SERVICES.API.url),
    health: () => `${URLS.api.base}/api/v1/healthz`,
  },
  
  // RAG Services
  rag: {
    embedding: getEnv('TEI_URL', SERVICES.EMBEDDING.url),
    vectorDb: getEnv('CHROMA_URL', SERVICES.VECTOR_DB.url),
  },
  
  // Public URLs
  public: {
    api: getEnv('PUBLIC_API_URL', 'https://api.nodove.com'),
    site: getEnv('PUBLIC_SITE_URL', 'https://noblog.nodove.com'),
  },
} as const;

// ============================================================================
// Legacy Compatibility (점진적 마이그레이션 지원)
// ============================================================================
// 기존 코드에서 사용하던 변수명을 새 시스템으로 매핑

export const LEGACY_MAPPINGS = {
  // 기존 → 새 시스템
  'VAS_CORE_URL': URLS.aiEngine.base,
  'TEI_URL': URLS.rag.embedding,
  'CHROMA_URL': URLS.rag.vectorDb,
} as const;

// ============================================================================
// Service Discovery Helpers
// ============================================================================

/**
 * Get service URL by name (for dynamic service discovery)
 */
export function getServiceUrl(serviceName: keyof typeof SERVICES): string {
  return SERVICES[serviceName].url;
}

/**
 * Check if running in Docker environment
 */
export function isDockerEnvironment(): boolean {
  return getEnv('DOCKER_ENV', 'false') === 'true' || 
         getEnv('KUBERNETES_SERVICE_HOST', '') !== '';
}

/**
 * Get appropriate URL based on environment
 * - In Docker: use internal service names
 * - Locally: use localhost with mapped ports
 */
export function getEnvironmentAwareUrl(
  serviceName: keyof typeof SERVICES,
  localPort?: number
): string {
  if (isDockerEnvironment()) {
    return SERVICES[serviceName].url;
  }
  
  const port = localPort || SERVICES[serviceName].port;
  return `http://localhost:${port}`;
}

// ============================================================================
// Validation & Health Check
// ============================================================================

export interface HealthCheckResult {
  service: string;
  url: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Check health of a service
 */
export async function checkServiceHealth(
  service: ServiceEndpoint,
  timeoutMs = 5000
): Promise<HealthCheckResult> {
  const url = `${service.url}${service.healthPath}`;
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      method: 'GET',
    });
    
    clearTimeout(timeoutId);
    
    return {
      service: service.name,
      url,
      healthy: response.ok,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      service: service.name,
      url,
      healthy: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check health of all services
 */
export async function checkAllServicesHealth(): Promise<HealthCheckResult[]> {
  const checks = Object.values(SERVICES).map(service => 
    checkServiceHealth(service)
  );
  return Promise.all(checks);
}

// ============================================================================
// Export Type Definitions
// ============================================================================

export type ServiceName = keyof typeof SERVICES;
export type PortName = keyof typeof PORTS;
