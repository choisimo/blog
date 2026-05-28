import { Hono } from 'hono';
import type { Context } from 'hono';
import type { HonoEnv } from '../types';
import { requireAdmin } from '../middleware/auth';
import { proxyToBackendWithPolicy } from '../lib/backend-proxy';

const agent = new Hono<HonoEnv>();

async function proxyAgentRequest(c: Context<HonoEnv>) {
  const pathname = new URL(c.req.url).pathname;
  return proxyToBackendWithPolicy(c, {
    upstreamPath: pathname,
    stream: pathname.endsWith('/stream'),
    forceAiModels: true,
    sanitizeClientModel: true,
    backendUnavailableMessage: 'Could not connect to agent backend',
  });
}

agent.use('*', requireAdmin);
agent.all('/', proxyAgentRequest);
agent.all('/*', proxyAgentRequest);

export default agent;
