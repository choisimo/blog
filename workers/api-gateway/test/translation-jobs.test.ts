import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { execute } from '../src/lib/d1';
import { createTranslationJobRow } from '../src/lib/translation-job-repository';
import {
  startTranslationJob,
  type TranslationJobSnapshot,
} from '../src/routes/lib/translation-jobs';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function buildUrls(suffix: string) {
  return {
    statusUrl: `https://example.com/status/${suffix}`,
    cacheUrl: `https://example.com/cache/${suffix}`,
    generateUrl: `https://example.com/generate/${suffix}`,
  };
}

function buildJobSnapshot(
  overrides: Partial<TranslationJobSnapshot> = {}
): TranslationJobSnapshot {
  return {
    id: overrides.id ?? `translation-job-${crypto.randomUUID()}`,
    type: overrides.type ?? 'translation.generate',
    key: overrides.key ?? '2026:dedupe-post:en',
    status: overrides.status ?? 'running',
    year: overrides.year ?? '2026',
    slug: overrides.slug ?? 'dedupe-post',
    targetLang: overrides.targetLang ?? 'en',
    sourceLang: overrides.sourceLang ?? 'ko',
    forceRefresh: overrides.forceRefresh ?? false,
    createdAt: overrides.createdAt ?? '2026-03-29T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-29T10:00:00.000Z',
    startedAt: overrides.startedAt ?? '2026-03-29T10:00:00.000Z',
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

describe('translation-jobs', () => {
  it('reuses the in-memory running job promise for concurrent callers', async () => {
    const deferred = createDeferred<string>();
    const runner = vi.fn(async () => deferred.promise);
    const awaitExisting = vi.fn(async () => 'unexpected');

    const first = await startTranslationJob<string>(env.DB, {
      key: '2026:dedupe-post:en',
      year: '2026',
      slug: 'dedupe-post',
      targetLang: 'en',
      sourceLang: 'ko',
      contentHash: 'hash-dedupe',
      urls: buildUrls('dedupe'),
      runner,
      awaitExisting,
    });

    const second = await startTranslationJob<string>(env.DB, {
      key: '2026:dedupe-post:en',
      year: '2026',
      slug: 'dedupe-post',
      targetLang: 'en',
      sourceLang: 'ko',
      contentHash: 'hash-dedupe',
      urls: buildUrls('dedupe-second'),
      runner: vi.fn(async () => 'should-not-run'),
      awaitExisting,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.job.id).toBe(first.job.id);
    expect(awaitExisting).not.toHaveBeenCalled();
    expect(runner).toHaveBeenCalledTimes(1);

    deferred.resolve('finished');

    await expect(first.wait).resolves.toBe('finished');
    await expect(second.wait).resolves.toBe('finished');
  });

  it('reuses durable running rows through awaitExisting when no in-memory promise exists', async () => {
    const existing = buildJobSnapshot({
      id: 'translation-job-existing',
      key: '2026:durable-post:en',
      slug: 'durable-post',
      targetLang: 'en',
      statusUrl: 'https://example.com/status/existing',
      cacheUrl: 'https://example.com/cache/existing',
      generateUrl: 'https://example.com/generate/existing',
    });

    await createTranslationJobRow(env.DB, {
      ...existing,
      contentHash: 'hash-durable',
    });

    const awaitExisting = vi.fn(async (job: TranslationJobSnapshot) => {
      expect(job.id).toBe(existing.id);
      return 'awaited-existing';
    });
    const runner = vi.fn(async () => 'should-not-run');

    const handle = await startTranslationJob<string>(env.DB, {
      key: existing.key,
      year: existing.year,
      slug: existing.slug,
      targetLang: existing.targetLang,
      sourceLang: existing.sourceLang,
      contentHash: 'hash-durable',
      urls: buildUrls('durable'),
      runner,
      awaitExisting,
    });

    expect(handle.created).toBe(false);
    expect(handle.job.id).toBe(existing.id);
    expect(runner).not.toHaveBeenCalled();
    expect(awaitExisting).toHaveBeenCalledOnce();
    await expect(handle.wait).resolves.toBe('awaited-existing');
  });
});
