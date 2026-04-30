import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { HonoEnv } from '../types';
import {
  buildRouteBoundaryHeaders,
  matchRouteBoundary,
  matchServiceBoundary,
  ROUTE_OWNERS,
} from '../../../../shared/src/contracts/service-boundaries.js';

import auth from './auth';
import comments from './comments';
import ai from './ai';
import chat from './chat';
import images from './images';
import og from './og';
import analytics from './analytics';
import translate from './translate';
import config from './config';
import rag from './rag';
import gateway from './gateway';
import memos from './memos';
import memories from './memories';
import adminAi from './admin-ai';
import adminOutbox from './admin-outbox';
import secrets from './secrets';
import internal from './internal';
import personas from './personas';
import userContent from './user-content';
import search from './search';
import user from './user';
import debate from './debate';
import subscribe from './subscribe';
import contact from './contact';
import notifications from './notifications';
import adminLogs from './admin-logs';
import siteContent from './site-content';

export type WorkerRouteRegistryEntry = {
  boundaryId: string;
  path: string;
  router: Hono<any>;
};

export const WORKER_ROUTE_REGISTRY: WorkerRouteRegistryEntry[] = [
  { boundaryId: 'auth', path: '/auth', router: auth },
  { boundaryId: 'comments', path: '/comments', router: comments },
  { boundaryId: 'ai', path: '/ai', router: ai },
  { boundaryId: 'chat', path: '/chat', router: chat },
  { boundaryId: 'images', path: '/images', router: images },
  { boundaryId: 'og', path: '/og', router: og },
  { boundaryId: 'analytics', path: '/analytics', router: analytics },
  { boundaryId: 'translate', path: '/', router: translate },
  { boundaryId: 'config', path: '/config', router: config },
  { boundaryId: 'rag', path: '/rag', router: rag },
  { boundaryId: 'memos', path: '/memos', router: memos },
  { boundaryId: 'memories', path: '/memories', router: memories },
  { boundaryId: 'admin-ai', path: '/admin/ai', router: adminAi },
  { boundaryId: 'admin-outbox', path: '/admin/outbox', router: adminOutbox },
  { boundaryId: 'admin-secrets', path: '/admin/secrets', router: secrets },
  { boundaryId: 'internal', path: '/internal', router: internal },
  { boundaryId: 'personas', path: '/personas', router: personas },
  { boundaryId: 'user-content', path: '/user-content', router: userContent },
  { boundaryId: 'search', path: '/search', router: search },
  { boundaryId: 'user', path: '/user', router: user },
  { boundaryId: 'debate', path: '/debate', router: debate },
  { boundaryId: 'subscribe', path: '/subscribe', router: subscribe },
  { boundaryId: 'contact', path: '/contact', router: contact },
  { boundaryId: 'notifications', path: '/notifications', router: notifications },
  { boundaryId: 'admin-logs', path: '/admin/logs', router: adminLogs },
  { boundaryId: 'site-content', path: '/site-content', router: siteContent },
  { boundaryId: 'gateway', path: '/gateway', router: gateway },
];

function normalizePublicApiPath(pathname: string, fallbackPath: string): string {
  const raw = typeof pathname === 'string' && pathname.trim() ? pathname : fallbackPath;

  if (raw.startsWith('/api/v1') || raw === '/health' || raw === '/metrics') {
    return raw;
  }

  if (raw === '/') {
    return '/api/v1';
  }

  return `/api/v1${raw.startsWith('/') ? raw : `/${raw}`}`;
}

function applyBoundaryHeaderMiddleware(boundaryId: string, routePath: string): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    await next();
    const pathname = normalizePublicApiPath(c.req.path, routePath);
    const headers = buildRouteBoundaryHeaders(
      { id: boundaryId, pathname, method: c.req.method },
      {
        responder: 'worker',
        edgeMode: 'native',
        originMode: 'worker',
      },
    );
    for (const [key, value] of Object.entries(headers) as [string, string][]) {
      c.res.headers.set(key, value);
    }
  };
}

export function registerWorkerRoutes(api: Hono<HonoEnv>) {
  for (const entry of WORKER_ROUTE_REGISTRY) {
    if (entry.path !== '/') {
      api.use(entry.path, applyBoundaryHeaderMiddleware(entry.boundaryId, entry.path));
      api.use(`${entry.path}/*`, applyBoundaryHeaderMiddleware(entry.boundaryId, entry.path));
    }
    api.route(entry.path, entry.router as Hono<any>);
  }
}

export function canProxyPath(pathname: string, method?: string) {
  const boundary = method
    ? matchRouteBoundary({ pathname, method }) || matchServiceBoundary(pathname)
    : matchServiceBoundary(pathname);

  return (
    boundary?.owner === ROUTE_OWNERS.BACKEND ||
    boundary?.owner === ROUTE_OWNERS.PROXY_ONLY ||
    boundary?.owner === ROUTE_OWNERS.COMPATIBILITY
  );
}

export function buildProxyBoundaryHeaders(pathname: string, method?: string) {
  return buildRouteBoundaryHeaders(
    method ? { pathname, method } : pathname,
    {
      responder: 'worker-proxy',
      edgeMode: 'proxy',
      originMode: 'backend',
    },
  );
}
