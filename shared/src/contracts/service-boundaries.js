export const ROUTE_OWNERS = Object.freeze({
  BACKEND: 'backend-owned',
  WORKER: 'worker-owned',
  PROXY_ONLY: 'proxy-only',
  COMPATIBILITY: 'compatibility',
});

export const SERVICE_BOUNDARIES = Object.freeze([
  { id: 'auth', prefix: '/api/v1/auth', owner: ROUTE_OWNERS.WORKER, description: 'Authentication, sessions, OAuth, TOTP' },
  { id: 'comments', prefix: '/api/v1/comments', owner: ROUTE_OWNERS.WORKER, description: 'Comment CRUD and moderation at the edge' },
  { id: 'ai', prefix: '/api/v1/ai', owner: ROUTE_OWNERS.WORKER, description: 'AI gateway and request shaping' },
  { id: 'chat', prefix: '/api/v1/chat', owner: ROUTE_OWNERS.WORKER, description: 'Chat streaming edge gateway' },
  { id: 'images', prefix: '/api/v1/images', owner: ROUTE_OWNERS.WORKER, description: 'Image upload and vision routing' },
  { id: 'og', prefix: '/api/v1/og', owner: ROUTE_OWNERS.WORKER, description: 'OpenGraph image generation' },
  { id: 'analytics', prefix: '/api/v1/analytics', owner: ROUTE_OWNERS.WORKER, description: 'Edge reads with backend-backed canonical analytics flows' },
  { id: 'translate', prefix: '/api/v1/translate', owner: ROUTE_OWNERS.WORKER, description: 'Translation jobs and cache orchestration' },
  { id: 'config', prefix: '/api/v1/config', owner: ROUTE_OWNERS.WORKER, description: 'Worker-side runtime config endpoints' },
  { id: 'rag', prefix: '/api/v1/rag', owner: ROUTE_OWNERS.WORKER, description: 'RAG query orchestration' },
  { id: 'memos', prefix: '/api/v1/memos', owner: ROUTE_OWNERS.WORKER, description: 'D1-backed memo workflows' },
  { id: 'memories', prefix: '/api/v1/memories', owner: ROUTE_OWNERS.WORKER, description: 'Edge memory store workflows' },
  { id: 'admin-ai', prefix: '/api/v1/admin/ai', owner: ROUTE_OWNERS.WORKER, description: 'Worker-managed AI admin APIs' },
  { id: 'admin-outbox', prefix: '/api/v1/admin/outbox', owner: ROUTE_OWNERS.WORKER, description: 'Worker outbox admin APIs' },
  { id: 'admin-secrets', prefix: '/api/v1/admin/secrets', owner: ROUTE_OWNERS.WORKER, description: 'Secret registry and edge encryption' },
  { id: 'admin-logs', prefix: '/api/v1/admin/logs', owner: ROUTE_OWNERS.WORKER, description: 'Worker/admin operational logs' },
  { id: 'internal', prefix: '/api/v1/internal', owner: ROUTE_OWNERS.WORKER, description: 'Internal worker-only control endpoints' },
  { id: 'personas', prefix: '/api/v1/personas', owner: ROUTE_OWNERS.WORKER, description: 'Persona and profile data' },
  { id: 'user-content', prefix: '/api/v1/user-content', owner: ROUTE_OWNERS.WORKER, description: 'User content APIs' },
  { id: 'search', prefix: '/api/v1/search', owner: ROUTE_OWNERS.WORKER, description: 'Search and web-enrichment endpoints' },
  { id: 'user', prefix: '/api/v1/user', owner: ROUTE_OWNERS.WORKER, description: 'User account endpoints' },
  { id: 'debate', prefix: '/api/v1/debate', owner: ROUTE_OWNERS.WORKER, description: 'Debate arena and session storage' },
  { id: 'subscribe', prefix: '/api/v1/subscribe', owner: ROUTE_OWNERS.WORKER, description: 'Email subscriptions' },
  { id: 'contact', prefix: '/api/v1/contact', owner: ROUTE_OWNERS.WORKER, description: 'Contact form ingestion' },
  { id: 'notifications', prefix: '/api/v1/notifications', owner: ROUTE_OWNERS.WORKER, description: 'Notification fan-out and live streams' },
  { id: 'gateway', prefix: '/api/v1/gateway', owner: ROUTE_OWNERS.WORKER, description: 'Internal gateway endpoints' },

  { id: 'posts', prefix: '/api/v1/posts', owner: ROUTE_OWNERS.BACKEND, description: 'Filesystem/GitHub post ingestion and publishing' },
  { id: 'agent', prefix: '/api/v1/agent', owner: ROUTE_OWNERS.BACKEND, description: 'Agent coordinator and tool execution' },
  { id: 'execute', prefix: '/api/v1/execute', owner: ROUTE_OWNERS.BACKEND, description: 'Code execution and terminal-adjacent backend tasks' },
  { id: 'admin-config', prefix: '/api/v1/admin/config', owner: ROUTE_OWNERS.BACKEND, description: 'Backend runtime config administration' },
  { id: 'admin-workers', prefix: '/api/v1/admin/workers', owner: ROUTE_OWNERS.BACKEND, description: 'Worker deployment admin APIs' },
  { id: 'admin', prefix: '/api/v1/admin', owner: ROUTE_OWNERS.BACKEND, description: 'Backend admin APIs and operational controls' },

  { id: 'healthz', prefix: '/api/v1/healthz', owner: ROUTE_OWNERS.PROXY_ONLY, description: 'Origin health check exposure through edge' },
  { id: 'health', prefix: '/health', owner: ROUTE_OWNERS.PROXY_ONLY, description: 'Backend health passthrough for compatibility' },
  { id: 'metrics', prefix: '/metrics', owner: ROUTE_OWNERS.PROXY_ONLY, description: 'Prometheus metrics exposure' },
  { id: 'public-config', prefix: '/api/v1/public/config', owner: ROUTE_OWNERS.COMPATIBILITY, description: 'Public runtime config served by both edge and origin' },
]);

export function matchServiceBoundary(input) {
  const pathname = typeof input === 'string' ? input : input?.pathname;
  if (!pathname) return null;
  const matches = SERVICE_BOUNDARIES
    .filter((boundary) => pathname === boundary.prefix || pathname.startsWith(`${boundary.prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  return matches[0] || null;
}

export function getBoundaryById(id) {
  return SERVICE_BOUNDARIES.find((boundary) => boundary.id === id) || null;
}

export function buildRouteBoundaryHeaders(input, options = {}) {
  const boundary =
    typeof input === 'string' && input.startsWith('/')
      ? matchServiceBoundary(input)
      : getBoundaryById(typeof input === 'string' ? input : input?.id);

  if (!boundary) {
    return {};
  }

  return {
    'X-Route-Boundary-Id': boundary.id,
    'X-Route-Owner': boundary.owner,
    'X-Route-Responder': options.responder || 'unknown',
    'X-Route-Edge-Mode': options.edgeMode || 'native',
    'X-Route-Origin-Mode': options.originMode || 'native',
  };
}

export function isWorkerOwnedPath(pathname) {
  return matchServiceBoundary(pathname)?.owner === ROUTE_OWNERS.WORKER;
}

export function isBackendOwnedPath(pathname) {
  return matchServiceBoundary(pathname)?.owner === ROUTE_OWNERS.BACKEND;
}

export function isProxyOnlyPath(pathname) {
  const owner = matchServiceBoundary(pathname)?.owner;
  return owner === ROUTE_OWNERS.PROXY_ONLY || owner === ROUTE_OWNERS.COMPATIBILITY;
}
