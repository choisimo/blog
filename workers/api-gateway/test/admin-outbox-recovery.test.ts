import { env, SELF } from 'cloudflare:test';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AI_ARTIFACT_STREAM } from '../src/lib/ai-artifact-outbox';
import { appendDomainOutboxEvent } from '../src/lib/domain-outbox';
import { signJwt } from '../src/lib/jwt';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'DB' | 'R2' | 'KV' | 'JWT_SECRET' | 'ENV'> {}
}

const outboxMocks = vi.hoisted(() => ({
  flushAiArtifactOutbox: vi.fn<
    (typeof import('../src/lib/ai-artifact-outbox'))['flushAiArtifactOutbox']
  >(),
}));

vi.mock('../src/lib/ai-artifact-outbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/ai-artifact-outbox')>();

  return {
    ...actual,
    flushAiArtifactOutbox: outboxMocks.flushAiArtifactOutbox,
  };
});

async function createAdminToken() {
  return signJwt(
    {
      sub: 'admin-1',
      role: 'admin',
      username: 'admin',
      emailVerified: true,
      type: 'access',
    },
    env,
  );
}

function expectHarnessBindings() {
  expect(env.DB).toBeDefined();
  expect(SELF).toBeDefined();
}

async function requestAdminOutbox(path: string, init?: RequestInit) {
  const { default: adminOutbox } = await import('../src/routes/admin-outbox');
  const app = new Hono();
  app.route('/api/v1/admin/outbox', adminOutbox);
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

async function seedTranslationOutboxEvent() {
  return appendDomainOutboxEvent(env.DB, {
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
}

beforeEach(async () => {
  expectHarnessBindings();
  vi.clearAllMocks();
  vi.resetModules();
  env.JWT_SECRET = 'test-admin-outbox-secret';
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
});

describe('admin outbox recovery routes', () => {
  it('flushes ai artifact outbox for authorized admins', async () => {
    const token = await createAdminToken();
    const flushResult = {
      processed: 2,
      deadLettered: 0,
      scanned: 3,
      skipped: false,
      reason: 'ok',
    };
    outboxMocks.flushAiArtifactOutbox.mockResolvedValueOnce(flushResult);

    const response = await requestAdminOutbox(
      `/api/v1/admin/outbox/${AI_ARTIFACT_STREAM}/ai-flush?limit=99`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const json = await response.json<{
      ok: boolean;
      data: typeof flushResult;
    }>();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, data: flushResult });
    expect(outboxMocks.flushAiArtifactOutbox).toHaveBeenCalledWith(env, { limit: 50 });
  });

  it('rejects ai flush for unsupported streams', async () => {
    const token = await createAdminToken();
    const response = await requestAdminOutbox(
      '/api/v1/admin/outbox/memory.embedding/ai-flush',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const json = await response.json<{
      ok: boolean;
      error: { message: string; code?: string };
    }>();

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.message).toContain('Unsupported stream: memory.embedding');
    expect(outboxMocks.flushAiArtifactOutbox).not.toHaveBeenCalled();
  });

  it('replays a known translation outbox event by id', async () => {
    const token = await createAdminToken();
    const seeded = await seedTranslationOutboxEvent();
    const eventId = seeded.id;

    await env.DB.prepare(
      "UPDATE domain_outbox SET status = 'processed', retry_count = 3, processed_at = ?, last_error = 'stale failure' WHERE id = ?",
    )
      .bind(new Date().toISOString(), eventId)
      .run();

    const response = await requestAdminOutbox(
      `/api/v1/admin/outbox/${AI_ARTIFACT_STREAM}/replay`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ids: [eventId] }),
      },
    );
    const json = await response.json<{
      ok: boolean;
      data: { replayed: number; ids: string[]; flush: null };
    }>();
    const row = await env.DB.prepare(
      'SELECT status, retry_count, processed_at, last_error FROM domain_outbox WHERE id = ?',
    )
      .bind(eventId)
      .first<{
        status: string;
        retry_count: number;
        processed_at: string | null;
        last_error: string | null;
      }>();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.replayed).toBe(1);
    expect(json.data.ids).toEqual([eventId]);
    expect(row).toEqual({
      status: 'pending',
      retry_count: 0,
      processed_at: null,
      last_error: null,
    });
  });

  it('rejects replay requests with an empty ids array', async () => {
    const token = await createAdminToken();
    const response = await requestAdminOutbox(
      `/api/v1/admin/outbox/${AI_ARTIFACT_STREAM}/replay`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ids: [] }),
      },
    );
    const json = await response.json<{
      ok: boolean;
      error: { message: string; code?: string };
    }>();

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.message).toBe('ids is required');
  });

  it('rejects unauthenticated ai flush requests', async () => {
    const response = await requestAdminOutbox(
      `/api/v1/admin/outbox/${AI_ARTIFACT_STREAM}/ai-flush`,
      { method: 'POST' },
    );

    expect([401, 403]).toContain(response.status);
    expect(outboxMocks.flushAiArtifactOutbox).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated replay requests', async () => {
    const seeded = await seedTranslationOutboxEvent();

    const response = await requestAdminOutbox(
      `/api/v1/admin/outbox/${AI_ARTIFACT_STREAM}/replay`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [seeded.id] }),
      },
    );

    expect([401, 403]).toContain(response.status);
  });
});
