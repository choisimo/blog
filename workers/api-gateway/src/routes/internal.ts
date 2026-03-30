/**
 * Internal Routes
 *
 * Backend-only routes for inter-service communication.
 * All routes here require X-Backend-Key authentication.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { success, unauthorized, serverError, badRequest } from '../lib/response';
import { getAiServeUrl, getAiDefaultModel } from '../lib/config';
import { getAiServeApiKey, getAIProviderKey } from '../lib/secrets';
import { getProvidersFromDB } from '../lib/provider-config';
import {
  enqueueFeedArtifactGeneration,
  enqueueTranslationGeneration,
  getWarmResourceSnapshot,
} from '../lib/ai-artifact-outbox';
import { fetchPublishedPost } from '../lib/translation-service';
import { sha256Hex } from '../lib/ai-artifacts';

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

internal.get('/ai-config/providers', async (c) => {
  const authError = requireBackendKey(c);
  if (authError) return authError;

  try {
    const providers = await getProvidersFromDB(c.env);
    const providersWithKeys = await Promise.all(
      providers.map(async (provider) => {
        const resolvedApiKey = await getAIProviderKey(c.env, provider.id);
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
      })
    );

    const models = await c.env.DB.prepare(
      `SELECT id, provider_id, model_name, display_name, model_identifier,
              context_window, max_tokens, supports_vision, supports_streaming,
              supports_function_calling, is_enabled, priority
       FROM ai_models WHERE is_enabled = 1 ORDER BY priority DESC`
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

    const defaultRoute = await c.env.DB.prepare(
      `SELECT id, name, routing_strategy, primary_model_id, fallback_model_ids,
              context_window_fallback_ids, num_retries, timeout_seconds,
              is_default, is_enabled
       FROM ai_routes WHERE is_default = 1 AND is_enabled = 1 LIMIT 1`
    ).first();

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

internal.get('/ai/resources', async (c) => {
  const authError = requireBackendKey(c);
  if (authError) return authError;

  try {
    const snapshot = await getWarmResourceSnapshot(c.env);
    return success(c, snapshot);
  } catch (error) {
    console.error('Failed to build warm resource snapshot:', error);
    return serverError(c, 'Failed to build warm resource snapshot');
  }
});

internal.post('/ai/warm', async (c) => {
  const authError = requireBackendKey(c);
  if (authError) return authError;

  const body = (await c.req.json().catch(() => ({}))) as {
    artifactTypes?: string[];
    year?: string;
    slug?: string;
    targetLangs?: string[];
    segments?: WarmSegment[];
    segmentIds?: string[];
    maxPagesPerArtifact?: number;
    priority?: WarmPriority;
    force?: boolean;
  };

  const artifactTypes = Array.isArray(body.artifactTypes) ? body.artifactTypes : [];
  if (artifactTypes.length === 0) {
    return badRequest(c, 'artifactTypes is required');
  }

  const priority = body.priority || 'publish';
  const targetLangs = (body.targetLangs || []).filter(
    (value): value is 'ko' | 'en' => value === 'ko' || value === 'en'
  );

  let segments = Array.isArray(body.segments)
    ? body.segments.filter((segment) => segment?.paragraph?.trim())
    : [];
  if (
    segments.length === 0 &&
    body.year &&
    body.slug &&
    artifactTypes.some((type) => type === 'feed.lens' || type === 'feed.thought')
  ) {
    const sourcePost = await fetchPublishedPost(c.env, body.year, body.slug);
    if (sourcePost) {
      segments = deriveSegmentsFromContent(sourcePost.content, sourcePost.title);
      if (Array.isArray(body.segmentIds) && body.segmentIds.length > 0) {
        const filtered: WarmSegment[] = [];
        for (const segment of segments) {
          const segmentId = await buildFeedSegmentId(body.year, body.slug, segment.paragraph);
          if (body.segmentIds.includes(segmentId)) {
            filtered.push(segment);
          }
        }
        segments = filtered;
      }
    }
  }

  let enqueued = 0;
  let skipped = 0;

  for (const artifactType of artifactTypes) {
    if (artifactType === 'translation') {
      if (!body.year || !body.slug || targetLangs.length === 0) {
        skipped += 1;
        continue;
      }

      for (const targetLang of targetLangs) {
        await enqueueTranslationGeneration(c.env, {
          year: body.year,
          slug: body.slug,
          targetLang,
          forceRefresh: body.force,
          priority,
        });
        enqueued += 1;
      }
      continue;
    }

    if ((artifactType === 'feed.lens' || artifactType === 'feed.thought') && segments.length > 0) {
      for (const segment of segments) {
        await enqueueFeedArtifactGeneration(c.env, {
          artifactType,
          paragraph: segment.paragraph,
          postTitle: segment.postTitle,
          count: 4,
          maxPages: body.maxPagesPerArtifact,
          priority,
        });
        enqueued += 1;
      }
      continue;
    }

    skipped += 1;
  }

  return success(c, {
    enqueued,
    skipped,
    duplicate: 0,
    outboxIds: [],
  });
});

internal.post('/ai/warm/revisit', async (c) => {
  const authError = requireBackendKey(c);
  if (authError) return authError;

  const body = (await c.req.json().catch(() => ({}))) as {
    year?: string;
    slug?: string;
    paragraph?: string;
    postTitle?: string;
    artifactTypes?: string[];
    priority?: WarmPriority;
  };

  if (!body.paragraph?.trim()) {
    return badRequest(c, 'paragraph is required');
  }

  const artifactTypes = Array.isArray(body.artifactTypes) ? body.artifactTypes : [];
  if (artifactTypes.length === 0) {
    return badRequest(c, 'artifactTypes is required');
  }

  let enqueued = 0;
  for (const artifactType of artifactTypes) {
    if (artifactType !== 'feed.lens' && artifactType !== 'feed.thought') {
      continue;
    }
    await enqueueFeedArtifactGeneration(c.env, {
      artifactType,
      paragraph: body.paragraph,
      postTitle: body.postTitle,
      count: 4,
      priority: body.priority || 'revisit',
    });
    enqueued += 1;
  }

  return success(c, { enqueued });
});

export default internal;
