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
  { id: 'chat', prefix: '/api/v1/chat', owner: ROUTE_OWNERS.WORKER, description: 'Hybrid chat surface: worker-owned feeds, backend-owned session/live operations via worker proxy' },
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
  { id: 'notifications', prefix: '/api/v1/notifications', owner: ROUTE_OWNERS.WORKER, description: 'Edge-authenticated notification ingress with backend-origin streaming/history handlers' },
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

export const ROUTE_BOUNDARIES = Object.freeze([
  { id: 'chat.session.create', method: 'POST', path: '/api/v1/chat/session', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'chat', description: 'Create backend chat session through worker proxy' },
  { id: 'chat.message', method: 'POST', path: '/api/v1/chat/session/:sessionId/message', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'chat', description: 'Backend chat completion streaming via worker proxy' },
  { id: 'chat.task', method: 'POST', path: '/api/v1/chat/session/:sessionId/task', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'chat', description: 'Backend task orchestration via worker proxy' },
  { id: 'chat.feed.lens', method: 'POST', path: '/api/v1/chat/session/:sessionId/lens-feed', owner: ROUTE_OWNERS.WORKER, boundaryId: 'chat', description: 'Worker-native lens feed generation' },
  { id: 'chat.feed.thought', method: 'POST', path: '/api/v1/chat/session/:sessionId/thought-feed', owner: ROUTE_OWNERS.WORKER, boundaryId: 'chat', description: 'Worker-native thought feed generation' },
  { id: 'chat.aggregate', method: 'POST', path: '/api/v1/chat/aggregate', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'chat', description: 'Backend aggregate summaries via worker proxy' },
  { id: 'chat.live.stream', method: 'GET', path: '/api/v1/chat/live/stream', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'chat', description: 'Backend live SSE stream via worker proxy' },
  { id: 'chat.live.message', method: 'POST', path: '/api/v1/chat/live/message', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'chat', description: 'Backend live message publish via worker proxy' },
  { id: 'chat.live.config.get', method: 'GET', path: '/api/v1/chat/live/config', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'chat', description: 'Backend live chat config read via worker proxy' },
  { id: 'chat.live.config.put', method: 'PUT', path: '/api/v1/chat/live/config', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'chat', description: 'Backend live chat config update via worker proxy' },
  { id: 'chat.live.room-stats', method: 'GET', path: '/api/v1/chat/live/room-stats', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'chat', description: 'Backend live room stats via worker proxy' },
  { id: 'chat.live.rooms', method: 'GET', path: '/api/v1/chat/live/rooms', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'chat', description: 'Backend live room list via worker proxy' },
  { id: 'notifications.stream', method: 'GET', path: '/api/v1/notifications/stream', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'notifications', description: 'Backend SSE notification stream via worker proxy' },
  { id: 'notifications.unread', method: 'GET', path: '/api/v1/notifications/unread', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'notifications', description: 'Backend unread notification list via worker proxy' },
  { id: 'notifications.history', method: 'GET', path: '/api/v1/notifications/history', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'notifications', description: 'Backend notification history via worker proxy' },
  { id: 'notifications.read', method: 'PATCH', path: '/api/v1/notifications/:notificationId/read', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'notifications', description: 'Backend notification read mutation via worker proxy' },
  { id: 'admin-logs.stream', method: 'GET', path: '/api/v1/admin/logs/stream', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'admin-logs', description: 'Backend admin log SSE stream via worker proxy' },
  { id: 'analytics.view', method: 'POST', path: '/api/v1/analytics/view', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'analytics', description: 'Backend canonical analytics writes via worker proxy' },
  { id: 'analytics.stats', method: 'GET', path: '/api/v1/analytics/stats/:year/:slug', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'analytics', description: 'Backend canonical analytics stats via worker proxy' },
  { id: 'analytics.trending', method: 'GET', path: '/api/v1/analytics/trending', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'analytics', description: 'Backend canonical trending analytics via worker proxy' },
  { id: 'analytics.refresh', method: 'POST', path: '/api/v1/analytics/refresh-stats', owner: ROUTE_OWNERS.BACKEND, boundaryId: 'analytics', description: 'Backend analytics refresh via worker proxy' },
]);

const ROUTE_BOUNDARY_MATCHERS = ROUTE_BOUNDARIES.map((boundary) => ({
  boundary,
  matcher: compileRoutePath(boundary.path),
}));

function normalizePathname(pathname) {
  if (typeof pathname !== 'string' || !pathname.trim()) {
    return null;
  }

  const withoutQuery = pathname.split('?')[0] || '';
  const normalized = withoutQuery.replace(/\/$/, '');
  return normalized || '/';
}

function normalizeMethod(method) {
  return typeof method === 'string' && method.trim() ? method.trim().toUpperCase() : null;
}

function compileRoutePath(pathPattern) {
  const escaped = pathPattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([A-Za-z0-9_]+)/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function resolveBoundaryInput(input) {
  if (typeof input === 'string') {
    if (input.startsWith('/')) {
      return { pathname: input, method: null, id: null };
    }
    return { pathname: null, method: null, id: input };
  }

  return {
    pathname: input?.pathname || input?.path || null,
    method: input?.method || null,
    id: input?.id || null,
  };
}

export function matchServiceBoundary(input) {
  const pathname = normalizePathname(typeof input === 'string' ? input : input?.pathname);
  if (!pathname) return null;
  const matches = SERVICE_BOUNDARIES
    .filter((boundary) => pathname === boundary.prefix || pathname.startsWith(`${boundary.prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  return matches[0] || null;
}

export function getBoundaryById(id) {
  return SERVICE_BOUNDARIES.find((boundary) => boundary.id === id) || null;
}

export function getRouteBoundaryById(id) {
  return ROUTE_BOUNDARIES.find((boundary) => boundary.id === id) || null;
}

export function matchRouteBoundary(input) {
  const method = normalizeMethod(typeof input === 'string' ? null : input?.method);
  const pathname = normalizePathname(typeof input === 'string' ? input : input?.pathname);
  if (!method || !pathname) return null;

  for (const entry of ROUTE_BOUNDARY_MATCHERS) {
    if (entry.boundary.method !== method) continue;
    if (entry.matcher.test(pathname)) {
      return entry.boundary;
    }
  }

  return null;
}

function resolveBoundaryMetadata(input) {
  const normalized = resolveBoundaryInput(input);

  if (normalized.pathname && normalized.method) {
    const routeBoundary = matchRouteBoundary({
      pathname: normalized.pathname,
      method: normalized.method,
    });
    if (routeBoundary) {
      return routeBoundary;
    }
  }

  if (normalized.id) {
    return getRouteBoundaryById(normalized.id) || getBoundaryById(normalized.id);
  }

  if (normalized.pathname) {
    return matchServiceBoundary(normalized.pathname);
  }

  return null;
}

export function buildRouteBoundaryHeaders(input, options = {}) {
  const boundary = resolveBoundaryMetadata(input);

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

export function isWorkerOwnedPath(pathname, method) {
  const routeBoundary = method
    ? matchRouteBoundary({ pathname, method })
    : null;
  return (routeBoundary || matchServiceBoundary(pathname))?.owner === ROUTE_OWNERS.WORKER;
}

export function isBackendOwnedPath(pathname, method) {
  const routeBoundary = method
    ? matchRouteBoundary({ pathname, method })
    : null;
  return (routeBoundary || matchServiceBoundary(pathname))?.owner === ROUTE_OWNERS.BACKEND;
}

export function isProxyOnlyPath(pathname, method) {
  const routeBoundary = method
    ? matchRouteBoundary({ pathname, method })
    : null;
  const owner = (routeBoundary || matchServiceBoundary(pathname))?.owner;
  return owner === ROUTE_OWNERS.PROXY_ONLY || owner === ROUTE_OWNERS.COMPATIBILITY;
}
