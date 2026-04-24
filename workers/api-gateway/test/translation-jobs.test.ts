import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { execute } from '../src/lib/d1';
import {
  claimTranslationJobLease,
  settleTranslationJobLease,
} from '../src/lib/translation-job-repository';
import {
  startTranslationJob,
  type TranslationJobSnapshot,
} from '../src/routes/lib/translation-jobs';

function buildRunningJob(): TranslationJobSnapshot & { contentHash: string } {
  return {
    id: 'translation-job-remote-owner',
    key: '2026:remote-owner:en',
    status: 'running',
    year: '2026',
    slug: 'remote-owner',
    targetLang: 'en',
    sourceLang: 'ko',
    forceRefresh: true,
    contentHash: 'hash-remote-owner',
    createdAt: '2026-03-27T10:00:00.000Z',
    updatedAt: '2026-03-27T10:00:00.000Z',
    startedAt: '2026-03-27T10:00:00.000Z',
    statusUrl: 'https://example.com/status/remote-owner',
    cacheUrl: 'https://example.com/cache/remote-owner',
    generateUrl: 'https://example.com/generate/remote-owner',
  };
}

beforeEach(async () => {
  await execute(env.DB, 'DELETE FROM translation_jobs');
});

describe('translation-jobs', () => {
  it('waits for an existing durable job instead of starting a duplicate runner', async () => {
    const running = buildRunningJob();
    const claim = await claimTranslationJobLease(env.DB, {
      ...running,
      lockToken: 'remote-owner-lock',
      lockExpiresAt: '2099-03-27T10:10:00.000Z',
    });

    const runner = vi.fn(async () => 'local-result');
    const resolveRemoteResult = vi.fn(async () => 'remote-result');

    const handle = await startTranslationJob<string>(env.DB, {
      key: running.key,
      year: running.year,
      slug: running.slug,
      targetLang: running.targetLang,
      sourceLang: running.sourceLang,
      forceRefresh: running.forceRefresh,
      contentHash: running.contentHash,
      urls: {
        statusUrl: running.statusUrl,
        cacheUrl: running.cacheUrl,
        generateUrl: running.generateUrl,
      },
      runner,
      resolveRemoteResult,
    });

    expect(handle.created).toBe(false);
    expect(handle.job.id).toBe(running.id);
    expect(runner).not.toHaveBeenCalled();

    const waitPromise = handle.wait;
    await settleTranslationJobLease(env.DB, {
      id: running.id,
      lockToken: 'remote-owner-lock',
      leaseVersion: claim.leaseVersion,
      status: 'succeeded',
      updatedAt: '2026-03-27T10:02:00.000Z',
      completedAt: '2026-03-27T10:02:00.000Z',
      result: {
        source: 'generated',
        cached: false,
        isAiGenerated: true,
        translationAvailable: true,
      },
    });

    await expect(waitPromise).resolves.toBe('remote-result');
    expect(resolveRemoteResult).toHaveBeenCalledWith(
      expect.objectContaining({
        id: running.id,
        status: 'succeeded',
      })
    );
    expect(runner).not.toHaveBeenCalled();
  });
});
