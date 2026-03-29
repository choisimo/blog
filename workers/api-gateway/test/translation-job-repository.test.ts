import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { execute, queryOne } from '../src/lib/d1';
import {
  createTranslationJobRow,
  fetchActiveTranslationJob,
  fetchTranslationJobById,
  upsertTranslationJobRow,
} from '../src/lib/translation-job-repository';
import type {
  TranslationJobError,
  TranslationJobResultSummary,
  TranslationJobSnapshot,
} from '../src/routes/lib/translation-jobs';

type TranslationJobInput = TranslationJobSnapshot & {
  contentHash: string;
};

function buildJobInput(overrides: Partial<TranslationJobInput> = {}): TranslationJobInput {
  return {
    id: overrides.id ?? `translation-job-${crypto.randomUUID()}`,
    type: overrides.type ?? 'translation.generate',
    key: overrides.key ?? '2026:durable-storage:ko',
    status: overrides.status ?? 'running',
    year: overrides.year ?? '2026',
    slug: overrides.slug ?? 'durable-storage',
    targetLang: overrides.targetLang ?? 'ko',
    sourceLang: overrides.sourceLang ?? 'en',
    forceRefresh: overrides.forceRefresh ?? false,
    contentHash: overrides.contentHash ?? 'hash-1',
    createdAt: overrides.createdAt ?? '2026-03-27T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-27T10:00:00.000Z',
    startedAt: overrides.startedAt ?? '2026-03-27T10:00:00.000Z',
    completedAt: overrides.completedAt,
    statusUrl: overrides.statusUrl ?? 'https://example.com/status/job-1',
    cacheUrl: overrides.cacheUrl ?? 'https://example.com/cache/job-1',
    generateUrl: overrides.generateUrl ?? 'https://example.com/generate/job-1',
    error: overrides.error,
    result: overrides.result,
  };
}

beforeEach(async () => {
  await execute(env.DB, 'DELETE FROM translation_jobs');
});

describe('translation-job-repository', () => {
  it('creates and fetches a translation job row round-trip', async () => {
    const error: TranslationJobError = {
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Retry later',
      retryable: true,
      retryAfterSeconds: 30,
    };
    const result: TranslationJobResultSummary = {
      source: 'generated',
      cached: false,
      isAiGenerated: true,
      translationAvailable: true,
      createdAt: '2026-03-27T10:02:00.000Z',
      updatedAt: '2026-03-27T10:03:00.000Z',
    };
    const input = buildJobInput({
      status: 'failed',
      forceRefresh: true,
      completedAt: '2026-03-27T10:04:00.000Z',
      error,
      result,
    });

    const created = await createTranslationJobRow(env.DB, input);
    const fetched = await fetchTranslationJobById(env.DB, input.id);

    expect(created).toEqual({
      id: input.id,
      type: input.type,
      key: input.key,
      status: input.status,
      year: input.year,
      slug: input.slug,
      targetLang: input.targetLang,
      sourceLang: input.sourceLang,
      forceRefresh: input.forceRefresh,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      statusUrl: input.statusUrl,
      cacheUrl: input.cacheUrl,
      generateUrl: input.generateUrl,
      error: input.error,
      result: input.result,
    });
    expect(fetched).toEqual(created);
  });

  it('deduplicates idempotent upserts for the same scope and content hash', async () => {
    const initial = buildJobInput({
      id: 'translation-job-initial',
      key: '2026:dedup-post:ja',
      slug: 'dedup-post',
      targetLang: 'ja',
      contentHash: 'hash-dedup',
      statusUrl: 'https://example.com/status/initial',
      cacheUrl: 'https://example.com/cache/initial',
      generateUrl: 'https://example.com/generate/initial',
    });
    const replacement = buildJobInput({
      id: 'translation-job-replacement',
      key: initial.key,
      year: initial.year,
      slug: initial.slug,
      targetLang: initial.targetLang,
      sourceLang: initial.sourceLang,
      forceRefresh: initial.forceRefresh,
      contentHash: initial.contentHash,
      createdAt: '2026-03-27T10:05:00.000Z',
      updatedAt: '2026-03-27T10:06:00.000Z',
      startedAt: '2026-03-27T10:05:00.000Z',
      statusUrl: 'https://example.com/status/replacement',
      cacheUrl: 'https://example.com/cache/replacement',
      generateUrl: 'https://example.com/generate/replacement',
    });

    await upsertTranslationJobRow(env.DB, initial);
    const second = await upsertTranslationJobRow(env.DB, replacement);
    const active = await fetchActiveTranslationJob(
      env.DB,
      initial.year,
      initial.slug,
      initial.targetLang,
      initial.contentHash
    );
    const countRow = await queryOne<{ count: number }>(
      env.DB,
      `SELECT COUNT(*) as count
         FROM translation_jobs
        WHERE year = ?
          AND slug = ?
          AND target_lang = ?
          AND content_hash = ?`,
      initial.year,
      initial.slug,
      initial.targetLang,
      initial.contentHash
    );

    expect(active).toEqual(second);
    expect(second.id).toBe('translation-job-initial');
    expect(Number(countRow?.count ?? 0)).toBe(1);
  });

  it('returns null when no active translation job exists for a scope and content hash', async () => {
    const fetched = await fetchActiveTranslationJob(
      env.DB,
      '2099',
      'missing-post',
      'fr',
      'hash-missing'
    );

    expect(fetched).toBeNull();
  });

  it('updates status on upsert for an existing scope and content hash', async () => {
    const running = buildJobInput({
      id: 'translation-job-status',
      key: '2026:status-post:de',
      slug: 'status-post',
      targetLang: 'de',
      contentHash: 'hash-status',
      status: 'running',
      completedAt: undefined,
      result: undefined,
    });
    const succeededResult: TranslationJobResultSummary = {
      source: 'cache',
      cached: true,
      isAiGenerated: true,
      translationAvailable: true,
      createdAt: '2026-03-27T10:00:00.000Z',
      updatedAt: '2026-03-27T10:10:00.000Z',
    };
    const succeeded = buildJobInput({
      id: running.id,
      key: running.key,
      year: running.year,
      slug: running.slug,
      targetLang: running.targetLang,
      sourceLang: running.sourceLang,
      forceRefresh: running.forceRefresh,
      contentHash: running.contentHash,
      createdAt: running.createdAt,
      updatedAt: '2026-03-27T10:10:00.000Z',
      startedAt: running.startedAt,
      completedAt: '2026-03-27T10:10:00.000Z',
      statusUrl: running.statusUrl,
      cacheUrl: running.cacheUrl,
      generateUrl: running.generateUrl,
      status: 'succeeded',
      result: succeededResult,
      error: undefined,
    });

    await upsertTranslationJobRow(env.DB, running);
    await upsertTranslationJobRow(env.DB, succeeded);

    const fetched = await fetchActiveTranslationJob(
      env.DB,
      running.year,
      running.slug,
      running.targetLang,
      running.contentHash
    );

    expect(fetched).not.toBeNull();
    expect(fetched?.status).toBe('succeeded');
    expect(fetched?.completedAt).toBe(succeeded.completedAt);
    expect(fetched?.result).toEqual(succeededResult);
  });
});
