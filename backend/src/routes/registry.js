import { buildRouteBoundaryHeaders } from '../../../shared/src/contracts/service-boundaries.js';

import aiRouter from './ai.js';
import analyticsRouter from './analytics.js';
import chatRouter from './chat.js';
import translateRouter from './translate.js';
import userContentRouter from './userContent.js';
import ogRouter from './og.js';
import adminRouter from './admin.js';
import postsRouter from './posts.js';
import imagesRouter from './images.js';
import ragRouter from './rag.js';
import memoriesRouter from './memories.js';
import memosRouter from './memos.js';
import userRouter from './user.js';
import searchRouter from './search.js';
import configRouter from './config.js';
import workersRouter from './workers.js';
import agentRouter from './agent.js';
import notificationsRouter from './notifications.js';
import debateRouter from './debate.js';
import adminLogsRouter from './adminLogs.js';
import adminAnalyticsRouter from './adminAnalytics.js';
import executeRouter from './execute.js';
import authRouter from './auth.js';
import { config } from '../config.js';

export const PUBLIC_ROUTE_REGISTRY = [
  { boundaryId: 'auth', basePath: '/api/v1/auth', router: authRouter },
  { boundaryId: 'notifications', basePath: '/api/v1/notifications', router: notificationsRouter },
];

export function getProtectedRouteRegistry() {
  return [
    { boundaryId: 'ai', basePath: '/api/v1/ai', router: aiRouter },
    { boundaryId: 'analytics', basePath: '/api/v1/analytics', router: analyticsRouter },
    { boundaryId: 'chat', basePath: '/api/v1/chat', router: chatRouter },
    { boundaryId: 'translate', basePath: '/api/v1', router: translateRouter },
    { boundaryId: 'memos', basePath: '/api/v1/memos', router: memosRouter },
    { boundaryId: 'user-content', basePath: '/api/v1/user-content', router: userContentRouter },
    { boundaryId: 'og', basePath: '/api/v1/og', router: ogRouter },
    { boundaryId: 'admin', basePath: '/api/v1/admin', router: adminRouter },
    { boundaryId: 'posts', basePath: '/api/v1/posts', router: postsRouter },
    { boundaryId: 'images', basePath: '/api/v1/images', router: imagesRouter },
    { boundaryId: 'rag', basePath: '/api/v1/rag', router: ragRouter },
    { boundaryId: 'memories', basePath: '/api/v1/memories', router: memoriesRouter },
    { boundaryId: 'user', basePath: '/api/v1/user', router: userRouter },
    { boundaryId: 'search', basePath: '/api/v1/search', router: searchRouter },
    { boundaryId: 'admin-config', basePath: '/api/v1/admin/config', router: configRouter },
    { boundaryId: 'admin-workers', basePath: '/api/v1/admin/workers', router: workersRouter },
    { boundaryId: 'admin-logs', basePath: '/api/v1/admin/logs', router: adminLogsRouter },
    { boundaryId: 'admin-analytics', basePath: '/api/v1/admin/analytics', router: adminAnalyticsRouter },
    { boundaryId: 'agent', basePath: '/api/v1/agent', router: agentRouter },
    { boundaryId: 'debate', basePath: '/api/v1/debate', router: debateRouter },
    { boundaryId: 'execute', basePath: '/api/v1/execute', router: executeRouter },
  ];
}

export const PROTECTED_ROUTE_REGISTRY = getProtectedRouteRegistry();

function normalizeMountedPath(basePath, requestPath) {
  const path = typeof requestPath === 'string' && requestPath.trim() ? requestPath : '/';
  if (path.startsWith('/api/v1') || path === '/health' || path === '/metrics') {
    return path;
  }

  if (path === '/') {
    return basePath;
  }

  return `${basePath.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function attachBoundaryHeaders(boundaryId, basePath, responder = 'backend') {
  return (req, res, next) => {
    const pathname = normalizeMountedPath(basePath, `${req.baseUrl || ''}${req.path || ''}` || req.originalUrl || basePath);
    const headers = buildRouteBoundaryHeaders(
      { id: boundaryId, pathname, method: req.method },
      {
        responder,
        edgeMode: 'origin-bypass',
        originMode: 'native',
      },
    );

    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    next();
  };
}

export function mountRouteRegistry(app, registry, responder = 'backend') {
  for (const entry of registry) {
    app.use(entry.basePath, attachBoundaryHeaders(entry.boundaryId, entry.basePath, responder), entry.router);
  }
}
