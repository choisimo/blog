import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AI_ARTIFACT_STREAM } from '../src/lib/ai-artifact-outbox';
import { appendDomainOutboxEvent } from '../src/lib/domain-outbox';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv
    extends Pick<Env, 'DB' | 'R2' | 'KV' | 'JWT_SECRET' | 'ENV' | 'BACKEND_KEY'> {}
}

const outboxMocks = vi.hoisted(() => ({
  flushAiArtifactOutbox: vi.fn<
    (typeof import('../src/lib/ai-artifact-outbox'))['flushAiArtifactOutbox']
  >(),
  getLatestSchedulerDecision: vi.fn<
    (typeof import('../src/lib/ai-artifacts'))['getLatestSchedulerDecision']
  >(),
}));

vi.mock('../src/lib/ai-artifact-outbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/ai-artifact-outbox')>();

  return {
    ...actual,
    flushAiArtifactOutbox: outboxMocks.flushAiArtifactOutbox,
  };
});

vi.mock('../src/lib/ai-artifacts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/ai-artifacts')>();

  return {
    ...actual,
    getLatestSchedulerDecision: outboxMocks.getLatestSchedulerDecision,
  };
});

async function requestInternal(path: string, init?: RequestInit) {
  const { default: internal } = await import('../src/routes/internal');
  const app = new Hono();
  app.route('/api/v1/internal', internal);
  return app.request(`https://example.com${path}`, init, env);
}

async function ensureDomainOutboxCompatColumns() {
  const columns = await env.DB.prepare('PRAGMA table_info(domain_outbox)').all<{
    name: string;
  }>();
  const knownColumns = new Set((columns.results || []).map((column) => column.name));

  if (!knownColumns.has('last_attempt_at')) {
    await env.DB.prepare('ALTER TABLE domain_outbox ADD COLUMN last_attempt_at TEXT').run();
  }

  if (!knownColumns.has('processed_at')) {
    await env.DB.prepare('ALTER TABLE domain_outbox ADD COLUMN processed_at TEXT').run();
  }

  if (!knownColumns.has('last_error')) {
    await env.DB.prepare('ALTER TABLE domain_outbox ADD COLUMN last_error TEXT').run();
  }
}

async function seedStuckAiArtifactEvent() {
  const seeded = await appendDomainOutboxEvent(env.DB, {
    stream: AI_ARTIFACT_STREAM,
    aggregateId: `2024:post-${crypto.randomUUID()}:en`,
    eventType: 'translation.generate',
    payload: {
      artifactType: 'translation',
      year: '2024',
      slug: `post-${crypto.randomUUID()}`,
      targetLang: 'en',
      sourceHash: 'sha256:test-hash',
      promptVersion: 'translation-v1',
      forceRefresh: false,
      priority: 'interactive',
    },
    idempotencyKey: `translation|${crypto.randomUUID()}`,
  });

  const staleAttemptAt = new Date(Date.now() - 20 * 60_000).toISOString();
  await env.DB.prepare(
    `UPDATE domain_outbox
        SET status = 'processing',
            retry_count = 1,
            last_attempt_at = ?,
            consumer_id = 'worker-test',
            locked_at = ?,
            updated_at = ?
      WHERE id = ?`,
  )
    .bind(staleAttemptAt, staleAttemptAt, staleAttemptAt, seeded.id)
    .run();

  return seeded.id;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  env.BACKEND_KEY = 'test-backend-key';
  await ensureDomainOutboxCompatColumns();
  await env.DB.prepare('DELETE FROM domain_outbox').run();

  outboxMocks.flushAiArtifactOutbox.mockReset();
  outboxMocks.flushAiArtifactOutbox.mockResolvedValue({
    processed: 1,
    deadLettered: 0,
    scanned: 1,
    skipped: false,
    reason: 'ok',
  });

  outboxMocks.getLatestSchedulerDecision.mockReset();
  outboxMocks.getLatestSchedulerDecision.mockResolvedValue({
    id: 'sched-1',
    schedulerId: 'artifact-scheduler',
    redisUp: true,
    queueEnabled: true,
    queueLength: 0,
    dlqLength: 0,
    allowWarm: true,
    decisionReason: 'healthy',
    snapshot: { queueLength: 0 },
    createdAt: new Date().toISOString(),
  });
});

describe('internal AI outbox routes', () => {
  it('returns outbox summary, stuck events, and scheduler state with backend key auth', async () => {
    const eventId = await seedStuckAiArtifactEvent();

    const response = await requestInternal('/api/v1/internal/ai/outbox/status', {
      method: 'GET',
      headers: {
        'X-Backend-Key': env.BACKEND_KEY,
      },
    });
    const json = await response.json<{
      ok: boolean;
      data: {
        stream: string;
        summary: {
          pending: number;
          processing: number;
          processed: number;
          deadLetter: number;
        };
        stuck: Array<{ id: string; status: string }>;
        scheduler: { schedulerId: string; decisionReason: string } | null;
      };
    }>();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.stream).toBe(AI_ARTIFACT_STREAM);
    expect(json.data.summary.processing).toBe(1);
    expect(json.data.stuck).toHaveLength(1);
    expect(json.data.stuck[0]).toMatchObject({ id: eventId, status: 'processing' });
    expect(json.data.scheduler).toMatchObject({
      schedulerId: 'artifact-scheduler',
      decisionReason: 'healthy',
    });
  });

  it('flushes the AI artifact outbox with backend key auth and caps the limit', async () => {
    const flushResult = {
      processed: 2,
      deadLettered: 0,
      scanned: 3,
      skipped: false,
      reason: 'ok',
    };
    outboxMocks.flushAiArtifactOutbox.mockResolvedValueOnce(flushResult);

    const response = await requestInternal('/api/v1/internal/ai/outbox/flush?limit=99', {
      method: 'POST',
      headers: {
        'X-Backend-Key': env.BACKEND_KEY,
      },
    });
    const json = await response.json<{
      ok: boolean;
      data: typeof flushResult & { stream: string };
    }>();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      stream: AI_ARTIFACT_STREAM,
      ...flushResult,
    });
    expect(outboxMocks.flushAiArtifactOutbox).toHaveBeenCalledWith(env, { limit: 50 });
  });

  it('rejects requests without a valid backend key', async () => {
    const response = await requestInternal('/api/v1/internal/ai/outbox/status', {
      method: 'GET',
    });

    expect(response.status).toBe(401);
  });
});
