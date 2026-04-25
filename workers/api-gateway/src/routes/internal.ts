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
  AI_ARTIFACT_STREAM,
  enqueueFeedArtifactGeneration,
  enqueueTranslationGeneration,
  flushAiArtifactOutbox,
  getWarmResourceSnapshot,
} from '../lib/ai-artifact-outbox';
import { fetchPublishedPost } from '../lib/translation-service';
import { sha256Hex } from '../lib/ai-artifacts';
import { getLatestSchedulerDecision } from '../lib/ai-artifacts';
import { getDomainOutboxSummary, listStuckDomainOutboxEvents } from '../lib/domain-outbox';

const internal = new Hono<HonoEnv>();

type WarmPriority = 'interactive' | 'publish' | 'revisit' | 'hot' | 'idle';

type WarmSegment = {
  paragraph: string;
  postTitle?: string;
};

async function sha256HexLocal(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hasValidBackendKey(c: import('hono').Context<HonoEnv>): Promise<boolean> {
  const env = c.env;
  const providedKey = c.req.header('X-Backend-Key');

  if (!providedKey || !env.BACKEND_KEY) {
    return false;
  }

  const [providedHash, expectedHash] = await Promise.all([
    sha256HexLocal(providedKey),
    sha256HexLocal(env.BACKEND_KEY),
  ]);
  return timingSafeHexEqual(providedHash, expectedHash);
}

internal.use('*', async (c, next) => {
  if (!(await hasValidBackendKey(c))) {
    return unauthorized(c, 'X-Backend-Key required');
  }

  await next();
});

function parseLimit(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(200, parsed));
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
  try {
    const snapshot = await getWarmResourceSnapshot(c.env);
    return success(c, snapshot);
  } catch (error) {
    console.error('Failed to build warm resource snapshot:', error);
    return serverError(c, 'Failed to build warm resource snapshot');
  }
});

internal.get('/ai/outbox/status', async (c) => {
  try {
    const olderThanMinutes = Math.min(parseLimit(c.req.query('olderThanMinutes'), 5), 60);
    const limit = Math.min(parseLimit(c.req.query('limit'), 20), 50);

    const [summary, stuck, scheduler] = await Promise.all([
      getDomainOutboxSummary(c.env.DB, AI_ARTIFACT_STREAM),
      listStuckDomainOutboxEvents(c.env.DB, {
        stream: AI_ARTIFACT_STREAM,
        olderThanMinutes,
        limit,
      }),
      getLatestSchedulerDecision(c.env.DB, 'artifact-scheduler'),
    ]);

    return success(c, {
      stream: AI_ARTIFACT_STREAM,
      summary,
      stuck,
      scheduler,
    });
  } catch (error) {
    console.error('Failed to build AI outbox status:', error);
    return serverError(c, 'Failed to build AI outbox status');
  }
});

internal.post('/ai/outbox/flush', async (c) => {
  try {
    const limit = Math.min(parseLimit(c.req.query('limit'), 10), 50);
    const result = await flushAiArtifactOutbox(c.env, { limit });
    return success(c, {
      stream: AI_ARTIFACT_STREAM,
      ...result,
    });
  } catch (error) {
    console.error('Failed to flush AI outbox:', error);
    return serverError(c, 'Failed to flush AI outbox');
  }
});

internal.post('/ai/warm', async (c) => {
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
