/**
 * Admin Agent Proxy
 *
 * The agent coordinator is backend-owned because it can execute privileged
 * tools. The public edge exposes only the known agent contract, requires an
 * email-verified admin JWT, signs the origin request, and forces server-side
 * model selection.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { HonoEnv } from '../types';
import { proxyToBackendWithPolicy } from '../lib/backend-proxy';
import { requireAdmin } from '../middleware/auth';

const agent = new Hono<HonoEnv>();

type AgentProxyOptions = {
  stream?: boolean;
};

function encodePathParam(value: string | undefined): string {
  return encodeURIComponent(value || '');
}

function proxyAgent(c: Context<HonoEnv>, path: string, options: AgentProxyOptions = {}) {
  return proxyToBackendWithPolicy(c, {
    upstreamPath: `/api/v1/agent${path}`,
    stream: options.stream,
    sanitizeClientModel: true,
    forceAiModels: true,
    injectFallbackAuthorization: false,
    backendUnavailableMessage: 'Could not connect to agent backend',
  });
}

agent.post('/run', requireAdmin, (c) => proxyAgent(c, '/run'));
agent.post('/stream', requireAdmin, (c) => proxyAgent(c, '/stream', { stream: true }));
agent.get('/session/:sessionId', requireAdmin, (c) =>
  proxyAgent(c, `/session/${encodePathParam(c.req.param('sessionId'))}`)
);
agent.delete('/session/:sessionId', requireAdmin, (c) =>
  proxyAgent(c, `/session/${encodePathParam(c.req.param('sessionId'))}`)
);
agent.get('/sessions', requireAdmin, (c) => proxyAgent(c, '/sessions'));
agent.get('/health', requireAdmin, (c) => proxyAgent(c, '/health'));
agent.get('/tools', requireAdmin, (c) => proxyAgent(c, '/tools'));
agent.get('/modes', requireAdmin, (c) => proxyAgent(c, '/modes'));
agent.post('/memory/extract', requireAdmin, (c) => proxyAgent(c, '/memory/extract'));
agent.post('/memory/search', requireAdmin, (c) => proxyAgent(c, '/memory/search'));
agent.get('/prompts', requireAdmin, (c) => proxyAgent(c, '/prompts'));
agent.put('/prompts/:mode', requireAdmin, (c) =>
  proxyAgent(c, `/prompts/${encodePathParam(c.req.param('mode'))}`)
);
agent.delete('/prompts/:mode', requireAdmin, (c) =>
  proxyAgent(c, `/prompts/${encodePathParam(c.req.param('mode'))}`)
);

export default agent;
