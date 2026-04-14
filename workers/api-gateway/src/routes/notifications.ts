import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { proxyToBackendWithPolicy } from '../lib/backend-proxy';

const notifications = new Hono<HonoEnv>();

notifications.get('/stream', requireAuth, async (c) => {
  return proxyToBackendWithPolicy(c, {
    upstreamPath: '/api/v1/notifications/stream',
    stream: true,
    backendUnavailableMessage: 'Could not connect to notifications backend',
  });
});

notifications.get('/unread', requireAuth, async (c) => {
  return proxyToBackendWithPolicy(c, {
    upstreamPath: '/api/v1/notifications/unread',
    backendUnavailableMessage: 'Could not connect to notifications backend',
  });
});

notifications.get('/history', requireAuth, async (c) => {
  return proxyToBackendWithPolicy(c, {
    upstreamPath: '/api/v1/notifications/history',
    backendUnavailableMessage: 'Could not connect to notifications backend',
  });
});

notifications.patch('/:notificationId/read', requireAuth, async (c) => {
  return proxyToBackendWithPolicy(c, {
    upstreamPath: `/api/v1/notifications/${encodeURIComponent(c.req.param('notificationId'))}/read`,
    backendUnavailableMessage: 'Could not connect to notifications backend',
  });
});

export default notifications;
