import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { badRequest, success } from '../lib/response';
import {
  getDomainOutboxSummary,
  listDomainOutboxEvents,
  listStuckDomainOutboxEvents,
  replayDomainOutboxEvent,
  type DomainOutboxStatus,
} from '../lib/domain-outbox';
import {
  flushAiArtifactOutbox,
  AI_ARTIFACT_STREAM,
} from '../lib/ai-artifact-outbox';
import {
  flushMemoryEmbeddingOutbox,
  MEMORY_EMBEDDING_STREAM,
} from '../lib/memory-embedding-outbox';
import { requireAdmin } from '../middleware/auth';

const adminOutbox = new Hono<HonoEnv>();

adminOutbox.use('*', requireAdmin);

function parseLimit(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(200, parsed));
}

function parseStatus(value: string | undefined): DomainOutboxStatus | undefined {
  if (
    value === 'pending' ||
    value === 'processing' ||
    value === 'processed' ||
    value === 'dead_letter'
  ) {
    return value;
  }
  return undefined;
}

adminOutbox.get('/:stream', async (c) => {
  const stream = c.req.param('stream');
  if (!stream) {
    return badRequest(c, 'stream is required');
  }

  const statusQuery = c.req.query('status');
  const status = parseStatus(statusQuery);
  if (statusQuery && !status) {
    return badRequest(c, `Unsupported status: ${statusQuery}`);
  }

  const limit = parseLimit(c.req.query('limit'), 25);
  const olderThanMinutes = parseLimit(c.req.query('olderThanMinutes'), 15);

  const [summary, items, stuck] = await Promise.all([
    getDomainOutboxSummary(c.env.DB, stream),
    listDomainOutboxEvents(c.env.DB, { stream, status, limit }),
    listStuckDomainOutboxEvents(c.env.DB, {
      stream,
      olderThanMinutes,
      limit,
    }),
  ]);

  return success(c, {
    summary,
    items,
    stuck,
  });
});

/**
 * Replay one or more outbox events by id. This also supports targeted
 * translation recovery by passing a single translation outbox event id.
 */
adminOutbox.post('/:stream/replay', async (c) => {
  const stream = c.req.param('stream');
  if (!stream) {
    return badRequest(c, 'stream is required');
  }

  const body = await c.req.json().catch(() => ({}));
  const ids = Array.isArray((body as { ids?: string[] }).ids)
    ? (body as { ids: string[] }).ids
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .slice(0, 100)
    : [];

  if (ids.length === 0) {
    return badRequest(c, 'ids is required');
  }

  for (const id of ids) {
    await replayDomainOutboxEvent(c.env.DB, id);
  }

  let flushResult: Awaited<ReturnType<typeof flushMemoryEmbeddingOutbox>> | null =
    null;
  if (stream === MEMORY_EMBEDDING_STREAM) {
    flushResult = await flushMemoryEmbeddingOutbox(c.env, {
      limit: Math.max(ids.length, 25),
    });
  }

  return success(c, {
    replayed: ids.length,
    ids,
    flush: flushResult,
  });
});

adminOutbox.post('/:stream/ai-flush', async (c) => {
  const stream = c.req.param('stream');
  const limit = Math.min(parseLimit(c.req.query('limit'), 10), 50);

  if (stream !== AI_ARTIFACT_STREAM) {
    return badRequest(c, `Unsupported stream: ${stream}`);
  }

  const result = await flushAiArtifactOutbox(c.env, { limit });
  return success(c, result);
});

adminOutbox.post('/:stream/flush', async (c) => {
  const stream = c.req.param('stream');
  const limit = parseLimit(c.req.query('limit'), 25);

  if (stream !== MEMORY_EMBEDDING_STREAM) {
    return badRequest(c, `Unsupported stream: ${stream}`);
  }

  const result = await flushMemoryEmbeddingOutbox(c.env, { limit });
  return success(c, result);
});

export default adminOutbox;
