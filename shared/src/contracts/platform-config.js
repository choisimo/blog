export const PLATFORM_CONFIG_CONTRACT = Object.freeze([
  {
    key: 'BACKEND_KEY',
    kind: 'secret',
    scope: ['backend', 'api-gateway'],
    sourceOfTruth: 'k3s Secret / GitHub Secrets / wrangler secret',
    description: 'Shared authentication key for worker-to-backend HTTP calls',
  },
  {
    key: 'JWT_SECRET',
    kind: 'secret',
    scope: ['backend', 'api-gateway', 'terminal-gateway'],
    sourceOfTruth: 'k3s Secret / GitHub Secrets / wrangler secret',
    description: 'JWT signing and verification key for user access tokens',
  },
  {
    key: 'TERMINAL_SESSION_SECRET',
    kind: 'secret',
    scope: ['terminal-gateway', 'terminal-server'],
    sourceOfTruth: 'k3s Secret / GitHub Secrets / wrangler secret',
    description: 'HMAC signing key for short-lived terminal origin admission tokens',
  },
  {
    key: 'TERMINAL_CONNECT_TOKEN_TTL_SECONDS',
    kind: 'config',
    scope: ['terminal-gateway', 'terminal-server'],
    sourceOfTruth: 'ConfigMap / .env / wrangler vars',
    description: 'TTL for gateway-issued terminal connect tokens',
    defaultValue: '60',
  },
  {
    key: 'TERMINAL_SESSION_TIMEOUT_MS',
    kind: 'config',
    scope: ['terminal-gateway', 'terminal-server'],
    sourceOfTruth: 'ConfigMap / .env',
    description: 'Maximum terminal session duration',
    defaultValue: '600000',
  },
  {
    key: 'TERMINAL_BLOCKED_COUNTRIES',
    kind: 'config',
    scope: ['terminal-gateway'],
    sourceOfTruth: 'ConfigMap / wrangler vars',
    description: 'Comma-separated geo-block allow/deny configuration',
    defaultValue: '',
  },
  {
    key: 'REDIS_URL',
    kind: 'secret',
    scope: ['backend', 'terminal-server'],
    sourceOfTruth: 'k3s Secret / .env',
    description: 'Redis connection URL used for cache and terminal session ownership',
  },
  {
    key: 'REDIS_PASSWORD',
    kind: 'secret',
    scope: ['backend', 'terminal-server'],
    sourceOfTruth: 'k3s Secret / .env / GitHub Secrets',
    description: 'Redis password when AUTH is enabled',
  },
  {
    key: 'BACKEND_ORIGIN',
    kind: 'secret',
    scope: ['api-gateway'],
    sourceOfTruth: 'wrangler secret / GitHub Secrets',
    description: 'Origin base URL for worker-to-backend proxying',
  },
  {
    key: 'TERMINAL_ORIGIN',
    kind: 'config',
    scope: ['terminal-gateway'],
    sourceOfTruth: 'wrangler vars',
    description: 'Terminal origin URL served behind the gateway',
  },
]);

export function getPlatformConfigEntry(key) {
  return PLATFORM_CONFIG_CONTRACT.find((item) => item.key === key) || null;
}

export function listPlatformConfigByScope(scope) {
  return PLATFORM_CONFIG_CONTRACT.filter((item) => item.scope.includes(scope));
}
