/**
 * Internal Routes
 *
 * Backend-only routes for inter-service communication.
 * All routes here require X-Backend-Key authentication.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { success, unauthorized, serverError } from '../lib/response';
import { getAiServeUrl, getAiDefaultModel } from '../lib/config';
import { getAiServeApiKey, getAIProviderKey } from '../lib/secrets';
import { getProvidersFromDB } from '../lib/provider-config';

const internal = new Hono<HonoEnv>();

type WarmPriority = 'interactive' | 'publish' | 'revisit' | 'hot' | 'idle';

type WarmSegment = {
  paragraph: string;
  postTitle?: string;
};

function requireBackendKey(c: import('hono').Context<HonoEnv>) {
  const env = c.env;
  const providedKey = c.req.header('X-Backend-Key');

  if (!providedKey || !env.BACKEND_KEY || providedKey !== env.BACKEND_KEY) {
    return unauthorized(c, 'X-Backend-Key required');
  }

  return null;
}

async function buildFeedSegmentId(year: string, slug: string, paragraph: string) {
  const hash = await sha256Hex(`${year}|${slug}|${paragraph.trim()}`);
  return hash.slice(0, 16);
}

function deriveSegmentsFromContent(content: string, postTitle: string): WarmSegment[] {
  const blocks = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !block.startsWith('```'))
    .filter((block) => !/^#{1,6}\s/.test(block))
    .filter((block) => block.length >= 60)
    .slice(0, 24);

  return blocks.map((paragraph) => ({
    paragraph,
    postTitle,
  }));
}

internal.get('/ai-config', async (c) => {
  const authError = requireBackendKey(c);
  if (authError) return authError;

  const [baseUrl, apiKey, defaultModel] = await Promise.all([
    getAiServeUrl(c.env),
    getAiServeApiKey(c.env),
    getAiDefaultModel(c.env),
  ]);

  return success(c, {
    baseUrl,
    apiKey: apiKey ?? null,
    defaultModel: defaultModel ?? null,
  });
});

/**
 * GET /api/v1/internal/ai-config/providers
 *
 * Returns full multi-provider snapshot: enabled providers (with resolved
 * API keys), their enabled models, and the default route.
 *
 * Used by backend multi-provider service to consume centralised config
 * instead of querying local D1 directly.
 *
 * Auth: X-Backend-Key header required (BACKEND_KEY env)
 */
internal.get('/ai-config/providers', async (c) => {
  const env = c.env;
  const providedKey = c.req.header('X-Backend-Key');

  if (!providedKey || !env.BACKEND_KEY || providedKey !== env.BACKEND_KEY) {
    return unauthorized(c, 'X-Backend-Key required');
  }

  try {
    // 1. Enabled providers (from D1 + KV cache)
    const providers = await getProvidersFromDB(env);

    // 2. Resolve API key for each provider in parallel
    const providersWithKeys = await Promise.all(
      providers.map(async (provider) => {
        const resolvedApiKey = await getAIProviderKey(env, provider.id);
        return {
          id: provider.id,
          name: provider.name,
          displayName: provider.displayName,
          apiBaseUrl: provider.apiBaseUrl,
          apiKeyEnv: provider.apiKeyEnv,
          isEnabled: provider.isEnabled,
          healthStatus: provider.healthStatus,
          resolvedApiKey: resolvedApiKey ?? null,
        };
      }),
    );

    // 3. Enabled models grouped by provider
    const models = await env.DB.prepare(
      `SELECT id, provider_id, model_name, display_name, model_identifier,
              context_window, max_tokens, supports_vision, supports_streaming,
              supports_function_calling, is_enabled, priority
       FROM ai_models WHERE is_enabled = 1 ORDER BY priority DESC`,
    ).all<{
      id: string;
      provider_id: string;
      model_name: string;
      display_name: string;
      model_identifier: string;
      context_window: number | null;
      max_tokens: number | null;
      supports_vision: number;
      supports_streaming: number;
      supports_function_calling: number;
      is_enabled: number;
      priority: number;
    }>();

    // 4. Default enabled route
    const defaultRoute = await env.DB.prepare(
      `SELECT id, name, routing_strategy, primary_model_id, fallback_model_ids,
              context_window_fallback_ids, num_retries, timeout_seconds,
              is_default, is_enabled
       FROM ai_routes WHERE is_default = 1 AND is_enabled = 1 LIMIT 1`,
    ).first<{
      id: string;
      name: string;
      routing_strategy: string;
      primary_model_id: string | null;
      fallback_model_ids: string | null;
      context_window_fallback_ids: string | null;
      num_retries: number;
      timeout_seconds: number;
      is_default: number;
      is_enabled: number;
    }>();

    return success(c, {
      providers: providersWithKeys,
      models: models.results ?? [],
      defaultRoute: defaultRoute ?? null,
    });
  } catch (err) {
    console.error('Failed to build provider snapshot:', err);
    return serverError(c, 'Failed to build provider snapshot');
  }
});

export default internal;
