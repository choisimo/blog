/**
 * Internal Routes
 *
 * Backend-only routes for inter-service communication.
 * All routes here require X-Backend-Key authentication.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { success, unauthorized } from '../lib/response';
import { getAiServeUrl, getAiDefaultModel } from '../lib/config';
import { getAiServeApiKey } from '../lib/secrets';

const internal = new Hono<HonoEnv>();

/**
 * GET /api/v1/internal/ai-config
 *
 * Returns current AI configuration from D1 secrets / KV / env.
 * Used by backend to dynamically refresh AI client config.
 *
 * Auth: X-Backend-Key header required (BACKEND_KEY env)
 */
internal.get('/ai-config', async (c) => {
  const env = c.env;
  const providedKey = c.req.header('X-Backend-Key');

  if (!providedKey || !env.BACKEND_KEY || providedKey !== env.BACKEND_KEY) {
    return unauthorized(c, 'X-Backend-Key required');
  }

  const [baseUrl, apiKey, defaultModel] = await Promise.all([
    getAiServeUrl(env),
    getAiServeApiKey(env),
    getAiDefaultModel(env),
  ]);

  return success(c, {
    baseUrl,
    apiKey: apiKey ?? null,
    defaultModel: defaultModel ?? null,
  });
});

export default internal;
