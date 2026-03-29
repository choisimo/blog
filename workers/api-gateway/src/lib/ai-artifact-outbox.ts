import type { Env } from '../types';
import { getAiDefaultModel } from './config';
import { getProvidersFromDB } from './provider-config';
import {
  appendDomainOutboxEvent,
  claimDomainOutboxEvents,
  getDomainOutboxEventByIdempotencyKey,
  markDomainOutboxFailed,
  markDomainOutboxProcessed,
  reviveDomainOutboxEvent,
} from './domain-outbox';
import {
  buildFeedScopeKey,
  buildFeedSourceHash,
  buildGenerationVersionHash,
  buildItemReadStates,
  computeItemHash,
  ensureAiArtifactSchema,
  getArtifactPageForVersion,
  getLatestReadyArtifactPage,
  recordSchedulerDecision,
  storeReadyArtifactPages,
  type AiArtifactFeedType,
  upsertWarmCandidate,
} from './ai-artifacts';
import {
  normalizeLensFeedRequest,
  normalizeLensFeedResponse,
  normalizeThoughtFeedRequest,
  normalizeThoughtFeedResponse,
} from './feed-normalizers';
import { buildLensFeedPrompt, buildThoughtFeedPrompt } from './feed-prompts';
import { callTaskLLM, tryParseJson } from './llm';
import type {
  LensCard,
  LensFeedResponse,
  NormalizedLensFeedRequest,
  NormalizedThoughtFeedRequest,
  ThoughtCard,
  ThoughtFeedResponse,
} from './feed-contract';
import {
  fetchPublishedPost,
  getValidCachedTranslation,
  hashContent,
  translateAndCachePost,
  type SupportedTranslationLang,
} from './translation-service';

export const AI_ARTIFACT_STREAM = 'ai.artifact.generate';
const FEED_SCHEMA_VERSION = '2';
const LENS_PROMPT_VERSION = 'feed-lens-v1';
const THOUGHT_PROMPT_VERSION = 'feed-thought-v1';
const TRANSLATION_PROMPT_VERSION = 'translate-v2';
const DEFAULT_FEED_MAX_PAGES = 2;
const MAX_QUEUE_LENGTH = 20;
const MAX_DLQ_LENGTH = 5;

type FeedGeneratePayload = {
  artifactType: AiArtifactFeedType;
  sessionId?: string;
  paragraph: string;
  postTitle?: string;
  scopeKey: string;
  sourceHash: string;
  promptVersion: string;
  schemaVersion: string;
  modelRoute: string;
  generationVersionHash: string;
  count: number;
  maxPages: number;
  priority: 'interactive' | 'publish' | 'revisit' | 'hot' | 'idle';
};

type TranslationGeneratePayload = {
  artifactType: 'translation';
  year: string;
  slug: string;
  targetLang: SupportedTranslationLang;
  sourceHash: string;
  promptVersion: string;
  forceRefresh?: boolean;
  priority: 'interactive' | 'publish' | 'revisit' | 'hot' | 'idle';
};

type QueueStatsSnapshot = {
  enabled: boolean;
  asyncMode: boolean;
  queueLength: number;
  dlqLength: number;
  redisUp: boolean;
  source: 'backend' | 'fallback';
};

export type WarmResourceSnapshot = {
  redisUp: boolean;
  queueEnabled: boolean;
  asyncMode: boolean;
  queueLength: number;
  dlqLength: number;
  allowWarm: boolean;
  reason: string;
  providerHealth: Array<{ id: string; healthStatus: string }>;
  timestamp: string;
};

function resourceReason(
  queue: QueueStatsSnapshot,
  providerHealth: Array<{ id: string; healthStatus: string }>
) {
  if (!queue.redisUp || !queue.enabled || !queue.asyncMode) return 'queue-unavailable';
  if (queue.queueLength >= MAX_QUEUE_LENGTH) return 'queue-busy';
  if (queue.dlqLength >= MAX_DLQ_LENGTH) return 'dlq-busy';
  if (providerHealth.some((provider) => provider.healthStatus === 'down')) {
    return 'provider-down';
  }
  return 'ok';
}

async function appendOrReuseOutboxEvent<TPayload>(
  env: Env,
  input: {
    aggregateId: string;
    eventType: string;
    payload: TPayload;
    idempotencyKey: string;
  }
) {
  try {
    return await appendDomainOutboxEvent(env.DB, {
      stream: AI_ARTIFACT_STREAM,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'domain outbox append failed';
    if (!message.includes('UNIQUE constraint')) {
      throw error;
    }
    const existing = await getDomainOutboxEventByIdempotencyKey(
      env.DB,
      AI_ARTIFACT_STREAM,
      input.idempotencyKey
    );
    if (!existing) {
      throw error;
    }
    if (existing.status === 'dead_letter') {
      await reviveDomainOutboxEvent(env.DB, existing.id);
      return { ...existing, status: 'pending' as const, retryCount: 0 };
    }
    return existing;
  }
}

async function fetchQueueStats(env: Env): Promise<QueueStatsSnapshot> {
  if (!env.BACKEND_ORIGIN) {
    return {
      enabled: false,
      asyncMode: false,
      queueLength: 0,
      dlqLength: 0,
      redisUp: false,
      source: 'fallback',
    };
  }

  try {
    const response = await fetch(`${env.BACKEND_ORIGIN.replace(/\/$/, '')}/api/v1/ai/queue-stats`, {
      headers: env.BACKEND_KEY ? { 'X-Backend-Key': env.BACKEND_KEY } : undefined,
    });
    if (!response.ok) {
      throw new Error(`queue stats failed: ${response.status}`);
    }
    const payload = (await response.json()) as {
      ok?: boolean;
      data?: {
        enabled?: boolean;
        asyncMode?: boolean;
        queueLength?: number;
        dlqLength?: number;
      };
    };
    return {
      enabled: payload.data?.enabled === true,
      asyncMode: payload.data?.asyncMode === true,
      queueLength: payload.data?.queueLength ?? 0,
      dlqLength: payload.data?.dlqLength ?? 0,
      redisUp: payload.data?.enabled === true,
      source: 'backend',
    };
  } catch (error) {
    console.warn('[ai-artifact] queue stats unavailable', error);
    return {
      enabled: false,
      asyncMode: false,
      queueLength: 0,
      dlqLength: 0,
      redisUp: false,
      source: 'fallback',
    };
  }
}

export async function getWarmResourceSnapshot(env: Env): Promise<WarmResourceSnapshot> {
  const [queueStats, providers] = await Promise.all([
    fetchQueueStats(env),
    getProvidersFromDB(env),
  ]);
  const providerHealth = providers.map((provider) => ({
    id: provider.id,
    healthStatus: provider.healthStatus,
  }));
  const reason = resourceReason(queueStats, providerHealth);

  return {
    redisUp: queueStats.redisUp,
    queueEnabled: queueStats.enabled,
    asyncMode: queueStats.asyncMode,
    queueLength: queueStats.queueLength,
    dlqLength: queueStats.dlqLength,
    allowWarm: reason === 'ok',
    reason,
    providerHealth,
    timestamp: new Date().toISOString(),
  };
}

export async function enqueueFeedArtifactGeneration(
  env: Env,
  input: {
    artifactType: AiArtifactFeedType;
    sessionId?: string;
    paragraph: string;
    postTitle?: string;
    count: number;
    maxPages?: number;
    priority?: 'interactive' | 'publish' | 'revisit' | 'hot' | 'idle';
  }
) {
  await ensureAiArtifactSchema(env.DB);
  const sourceHash = await buildFeedSourceHash(input.paragraph, input.postTitle);
  const scopeKey = await buildFeedScopeKey(input.paragraph, input.postTitle);
  const modelRoute = (await getAiDefaultModel(env)) || 'default';
  const promptVersion =
    input.artifactType === 'feed.lens' ? LENS_PROMPT_VERSION : THOUGHT_PROMPT_VERSION;
  const generationVersionHash = await buildGenerationVersionHash({
    sourceHash,
    artifactType: input.artifactType,
    promptVersion,
    schemaVersion: FEED_SCHEMA_VERSION,
    modelRoute,
  });

  const payload: FeedGeneratePayload = {
    artifactType: input.artifactType,
    sessionId: input.sessionId,
    paragraph: input.paragraph,
    postTitle: input.postTitle,
    scopeKey,
    sourceHash,
    promptVersion,
    schemaVersion: FEED_SCHEMA_VERSION,
    modelRoute,
    generationVersionHash,
    count: input.count,
    maxPages: Math.max(1, input.maxPages ?? DEFAULT_FEED_MAX_PAGES),
    priority: input.priority ?? 'interactive',
  };

  const event = await appendOrReuseOutboxEvent(env, {
    aggregateId: scopeKey,
    eventType: `${input.artifactType}.generate`,
    payload,
    idempotencyKey: `${input.artifactType}|${scopeKey}|${generationVersionHash}|p:0`,
  });

  await upsertWarmCandidate(env.DB, {
    artifactType: input.artifactType,
    scopeKey,
    sourceRef: JSON.stringify({
      postTitle: input.postTitle || '',
      paragraph: input.paragraph.slice(0, 240),
    }),
    priority: payload.priority,
    targetPages: payload.maxPages,
    meta: { sessionId: input.sessionId || null },
  });

  return {
    event,
    scopeKey,
    sourceHash,
    generationVersionHash,
    promptVersion,
    modelRoute,
  };
}

export async function enqueueTranslationGeneration(
  env: Env,
  input: {
    year: string;
    slug: string;
    targetLang: SupportedTranslationLang;
    forceRefresh?: boolean;
    priority?: 'interactive' | 'publish' | 'revisit' | 'hot' | 'idle';
  }
) {
  await ensureAiArtifactSchema(env.DB);
  const sourcePost = await fetchPublishedPost(env, input.year, input.slug);
  if (!sourcePost) {
    throw new Error('Published post not found');
  }

  const sourceHash = `sha256:${hashContent(sourcePost.content)}`;
  const scopeKey = `${input.year}:${input.slug}:${input.targetLang}`;
  const modelRoute = (await getAiDefaultModel(env)) || 'default';
  const generationVersionHash = await buildGenerationVersionHash({
    sourceHash,
    artifactType: 'translation',
    promptVersion: TRANSLATION_PROMPT_VERSION,
    schemaVersion: '1',
    modelRoute,
  });

  const payload: TranslationGeneratePayload = {
    artifactType: 'translation',
    year: input.year,
    slug: input.slug,
    targetLang: input.targetLang,
    sourceHash,
    promptVersion: TRANSLATION_PROMPT_VERSION,
    forceRefresh: input.forceRefresh,
    priority: input.priority ?? 'interactive',
  };

  const event = await appendOrReuseOutboxEvent(env, {
    aggregateId: scopeKey,
    eventType: 'translation.generate',
    payload,
    idempotencyKey: `translation|${scopeKey}|${generationVersionHash}|p:0`,
  });

  await upsertWarmCandidate(env.DB, {
    artifactType: 'translation',
    scopeKey,
    sourceRef: JSON.stringify({ year: input.year, slug: input.slug }),
    targetLang: input.targetLang,
    priority: payload.priority,
    targetPages: 1,
    meta: { forceRefresh: Boolean(input.forceRefresh) },
  });

  return {
    event,
    scopeKey,
    sourceHash,
    generationVersionHash,
  };
}

async function generateLensPages(env: Env, payload: FeedGeneratePayload) {
  const baseRequest = normalizeLensFeedRequest({
    paragraph: payload.paragraph,
    postTitle: payload.postTitle,
    count: payload.count,
  });
  if (!baseRequest) {
    throw new Error('Invalid lens feed request');
  }

  let request: NormalizedLensFeedRequest = baseRequest;
  const pages: Array<{
    pageNo: number;
    payload: LensFeedResponse;
    logicalKeys: string[];
    itemHashes: string[];
    exhausted: boolean;
  }> = [];

  for (let pageNo = 0; pageNo < payload.maxPages; pageNo += 1) {
    let normalized: LensFeedResponse | null = null;
    try {
      const response = await callTaskLLM(buildLensFeedPrompt(request), env);
      if (response.ok) {
        const candidate =
          response.parsed ??
          (response.text ? (tryParseJson(response.text) ?? response.text) : null);
        normalized = normalizeLensFeedResponse(candidate, request);
      }
    } catch (error) {
      console.warn('[ai-artifact] lens generation failed', error);
    }

    if (normalized === null) {
      if (pageNo === 0) {
        throw new Error(
          '[ai-artifact] lens first page normalization failed; refusing to store fallback as ready snapshot'
        );
      }
      // Partial success: prior pages are usable, stop accumulating
      break;
    }

    const finalPayload = normalized;
    const logicalKeys = finalPayload.items.map((item) => item.angleKey);
    const itemHashes = await Promise.all(
      finalPayload.items.map((item) =>
        computeItemHash(payload.generationVersionHash, item.angleKey, item)
      )
    );
    pages.push({
      pageNo,
      payload: finalPayload,
      logicalKeys,
      itemHashes,
      exhausted: finalPayload.exhausted,
    });

    if (finalPayload.exhausted || !finalPayload.nextCursor) {
      break;
    }

    request = {
      ...request,
      cursor: finalPayload.nextCursor,
    };
  }

  return pages;
}

async function generateThoughtPages(env: Env, payload: FeedGeneratePayload) {
  const baseRequest = normalizeThoughtFeedRequest({
    paragraph: payload.paragraph,
    postTitle: payload.postTitle,
    count: payload.count,
  });
  if (!baseRequest) {
    throw new Error('Invalid thought feed request');
  }

  let request: NormalizedThoughtFeedRequest = baseRequest;
  const pages: Array<{
    pageNo: number;
    payload: ThoughtFeedResponse;
    logicalKeys: string[];
    itemHashes: string[];
    exhausted: boolean;
  }> = [];

  for (let pageNo = 0; pageNo < payload.maxPages; pageNo += 1) {
    let normalized: ThoughtFeedResponse | null = null;
    try {
      const response = await callTaskLLM(buildThoughtFeedPrompt(request), env);
      if (response.ok) {
        const candidate =
          response.parsed ??
          (response.text ? (tryParseJson(response.text) ?? response.text) : null);
        normalized = normalizeThoughtFeedResponse(candidate, request);
      }
    } catch (error) {
      console.warn('[ai-artifact] thought generation failed', error);
    }

    if (normalized === null) {
      if (pageNo === 0) {
        throw new Error(
          '[ai-artifact] thought first page normalization failed; refusing to store fallback as ready snapshot'
        );
      }
      // Partial success: prior pages are usable, stop accumulating
      break;
    }

    const finalPayload = normalized;
    const logicalKeys = finalPayload.items.map((item) => item.trackKey);
    const itemHashes = await Promise.all(
      finalPayload.items.map((item) =>
        computeItemHash(payload.generationVersionHash, item.trackKey, item)
      )
    );
    pages.push({
      pageNo,
      payload: finalPayload,
      logicalKeys,
      itemHashes,
      exhausted: finalPayload.exhausted,
    });

    if (finalPayload.exhausted || !finalPayload.nextCursor) {
      break;
    }

    request = {
      ...request,
      cursor: finalPayload.nextCursor,
    };
  }

  return pages;
}

export async function processFeedEvent(env: Env, payload: FeedGeneratePayload) {
  const baseInput = {
    artifactType: payload.artifactType,
    scopeKey: payload.scopeKey,
    scopeType: 'post_segment',
    sourceRef: JSON.stringify({
      postTitle: payload.postTitle || '',
      paragraph: payload.paragraph.slice(0, 240),
    }),
    sourceHash: payload.sourceHash,
    promptVersion: payload.promptVersion,
    schemaVersion: payload.schemaVersion,
    modelRoute: payload.modelRoute,
    generationVersionHash: payload.generationVersionHash,
    meta: {
      count: payload.count,
      maxPages: payload.maxPages,
      priority: payload.priority,
    },
  } as const;

  if (payload.artifactType === 'feed.lens') {
    const pages = await generateLensPages(env, payload);
    await storeReadyArtifactPages<LensCard>(env.DB, {
      ...baseInput,
      artifactType: 'feed.lens',
      pages,
    });
    return;
  }

  const pages = await generateThoughtPages(env, payload);
  await storeReadyArtifactPages<ThoughtCard>(env.DB, {
    ...baseInput,
    artifactType: 'feed.thought',
    pages,
  });
}

async function processTranslationEvent(env: Env, payload: TranslationGeneratePayload) {
  const sourcePost = await fetchPublishedPost(env, payload.year, payload.slug);
  if (!sourcePost) {
    throw new Error('Published post not found');
  }

  // Skip if source and target languages are the same
  if (sourcePost.sourceLang === payload.targetLang) {
    return;
  }

  const cached = await getValidCachedTranslation(env.DB, sourcePost, payload.targetLang);
  if (cached && !payload.forceRefresh) {
    return;
  }

  await translateAndCachePost(env, env.DB, {
    year: sourcePost.year,
    slug: sourcePost.slug,
    targetLang: payload.targetLang,
    sourceLang: sourcePost.sourceLang,
    title: sourcePost.title,
    description: sourcePost.description,
    content: sourcePost.content,
    forceRefresh: payload.forceRefresh,
  });
}

export async function flushAiArtifactOutbox(env: Env, options: { limit?: number } = {}) {
  await ensureAiArtifactSchema(env.DB);

  const resource = await getWarmResourceSnapshot(env);
  await recordSchedulerDecision(env.DB, {
    schedulerId: 'artifact-scheduler',
    redisUp: resource.redisUp,
    queueEnabled: resource.queueEnabled,
    queueLength: resource.queueLength,
    dlqLength: resource.dlqLength,
    allowWarm: resource.allowWarm,
    decisionReason: resource.reason,
    snapshot: resource,
  });

  if (!resource.allowWarm) {
    return {
      processed: 0,
      deadLettered: 0,
      scanned: 0,
      skipped: true,
      reason: resource.reason,
    };
  }

  const events = await claimDomainOutboxEvents(env.DB, {
    stream: AI_ARTIFACT_STREAM,
    limit: options.limit ?? 8,
  });

  let processed = 0;
  let deadLettered = 0;

  for (const event of events) {
    try {
      if (event.eventType === 'translation.generate') {
        await processTranslationEvent(env, event.payload as TranslationGeneratePayload);
      } else if (
        event.eventType === 'feed.lens.generate' ||
        event.eventType === 'feed.thought.generate'
      ) {
        await processFeedEvent(env, event.payload as FeedGeneratePayload);
      }

      await markDomainOutboxProcessed(env.DB, event.id);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ai artifact generation failed';
      const result = await markDomainOutboxFailed(env.DB, {
        id: event.id,
        lastError: message,
        maxRetries: 5,
      });
      if (result.status === 'dead_letter') {
        deadLettered += 1;
      }
    }
  }

  return {
    processed,
    deadLettered,
    scanned: events.length,
    skipped: false,
    reason: resource.reason,
  };
}

export async function generateAndStoreInitialFeedArtifact(
  env: Env,
  input: {
    artifactType: AiArtifactFeedType;
    sessionId?: string;
    paragraph: string;
    postTitle?: string;
    count: number;
    maxPages?: number;
  }
): Promise<void> {
  await ensureAiArtifactSchema(env.DB);
  const sourceHash = await buildFeedSourceHash(input.paragraph, input.postTitle);
  const scopeKey = await buildFeedScopeKey(input.paragraph, input.postTitle);
  const modelRoute = (await getAiDefaultModel(env)) || 'default';
  const promptVersion =
    input.artifactType === 'feed.lens' ? LENS_PROMPT_VERSION : THOUGHT_PROMPT_VERSION;
  const generationVersionHash = await buildGenerationVersionHash({
    sourceHash,
    artifactType: input.artifactType,
    promptVersion,
    schemaVersion: FEED_SCHEMA_VERSION,
    modelRoute,
  });
  const payload: FeedGeneratePayload = {
    artifactType: input.artifactType,
    sessionId: input.sessionId,
    paragraph: input.paragraph,
    postTitle: input.postTitle,
    scopeKey,
    sourceHash,
    promptVersion,
    schemaVersion: FEED_SCHEMA_VERSION,
    modelRoute,
    generationVersionHash,
    count: input.count,
    maxPages: Math.max(1, input.maxPages ?? 1),
    priority: 'interactive',
  };
  await processFeedEvent(env, payload);
}

export async function getServeableFeedPage<T extends LensCard | ThoughtCard>(
  env: Env,
  input: {
    artifactType: AiArtifactFeedType;
    sessionId: string;
    paragraph: string;
    postTitle?: string;
    pageNo: number;
  }
) {
  await ensureAiArtifactSchema(env.DB);
  const scopeKey = await buildFeedScopeKey(input.paragraph, input.postTitle);
  const sourceHash = await buildFeedSourceHash(input.paragraph, input.postTitle);
  const modelRoute = (await getAiDefaultModel(env)) || 'default';
  const promptVersion =
    input.artifactType === 'feed.lens' ? LENS_PROMPT_VERSION : THOUGHT_PROMPT_VERSION;
  const generationVersionHash = await buildGenerationVersionHash({
    sourceHash,
    artifactType: input.artifactType,
    promptVersion,
    schemaVersion: FEED_SCHEMA_VERSION,
    modelRoute,
  });

  const exact = await getArtifactPageForVersion<T>(
    env.DB,
    input.artifactType,
    scopeKey,
    generationVersionHash,
    input.pageNo
  );
  if (exact) {
    const readState = await buildItemReadStates(env.DB, {
      userKey: input.sessionId,
      artifactType: input.artifactType,
      scopeKey,
      logicalKeys: exact.logicalKeys,
      itemHashes: exact.itemHashes,
    });

    return {
      page: exact,
      scopeKey,
      sourceHash,
      generationVersionHash,
      readState,
      stale: false,
      warming: false,
    };
  }

  const stale = await getLatestReadyArtifactPage<T>(
    env.DB,
    input.artifactType,
    scopeKey,
    input.pageNo
  );
  if (stale) {
    const readState = await buildItemReadStates(env.DB, {
      userKey: input.sessionId,
      artifactType: input.artifactType,
      scopeKey,
      logicalKeys: stale.logicalKeys,
      itemHashes: stale.itemHashes,
    });

    return {
      page: stale,
      scopeKey,
      sourceHash,
      generationVersionHash,
      readState,
      stale: true,
      warming: true,
    };
  }

  return {
    page: null,
    scopeKey,
    sourceHash,
    generationVersionHash,
    readState: { itemStates: [], unreadCount: 0 },
    stale: false,
    warming: true,
  };
}
