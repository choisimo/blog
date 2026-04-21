import type { D1Database } from '@cloudflare/workers-types';

import {
  claimTranslationJobLease,
  fetchActiveTranslationJob,
  fetchTranslationJobById,
  settleTranslationJobLease,
} from '../../lib/translation-job-repository';

type TranslationJobState = 'running' | 'succeeded' | 'failed';

export type TranslationJobError = {
  status: number;
  code?: string;
  message: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
};

export type TranslationJobResultSummary = {
  source: 'cache' | 'generated' | 'passthrough';
  cached: boolean;
  isAiGenerated: boolean;
  translationAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TranslationJobSnapshot = {
  id: string;
  key: string;
  status: TranslationJobState;
  year: string;
  slug: string;
  targetLang: string;
  sourceLang?: string;
  forceRefresh: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt: string;
  completedAt?: string;
  statusUrl: string;
  cacheUrl: string;
  generateUrl: string;
  error?: TranslationJobError;
  result?: TranslationJobResultSummary;
};

type TranslationJobUrls = {
  statusUrl: string;
  cacheUrl: string;
  generateUrl: string;
};

type StartTranslationJobInput<T> = {
  key: string;
  year: string;
  slug: string;
  targetLang: string;
  sourceLang?: string;
  forceRefresh?: boolean;
  contentHash: string;
  urls: TranslationJobUrls;
  runner: () => Promise<T>;
  resolveRemoteResult: (job: TranslationJobSnapshot) => Promise<T>;
  summarizeResult?: (result: T) => TranslationJobResultSummary;
  normalizeError?: (error: unknown) => TranslationJobError;
  onSuccess?: (result: T, job: TranslationJobSnapshot) => Promise<void>;
  onFailure?: (
    error: unknown,
    job: TranslationJobSnapshot,
    details: TranslationJobError
  ) => Promise<void>;
};

type TranslationJobHandle<T> = {
  created: boolean;
  job: TranslationJobSnapshot;
  wait: Promise<T>;
};

const runningJobs = new Map<string, Promise<unknown>>();
const TRANSLATION_JOB_LEASE_TTL_MS = 2 * 60 * 1000;
const REMOTE_JOB_POLL_INTERVAL_MS = 200;
const REMOTE_JOB_WAIT_TIMEOUT_MS = TRANSLATION_JOB_LEASE_TTL_MS + 15 * 1000;

function defaultJobError(error: unknown): TranslationJobError {
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Translation job failed',
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRemoteJobError(details?: TranslationJobError): Error {
  const error = new Error(details?.message ?? 'Translation job failed');
  if (details?.code) {
    error.name = details.code;
  }
  return error;
}

async function waitForRemoteTranslationJob<T>(
  db: D1Database,
  jobId: string,
  resolveRemoteResult: (job: TranslationJobSnapshot) => Promise<T>
): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < REMOTE_JOB_WAIT_TIMEOUT_MS) {
    const latestJob = await fetchTranslationJobById(db, jobId);
    if (!latestJob) {
      throw new Error(`Translation job not found: ${jobId}`);
    }

    if (latestJob.status === 'succeeded') {
      return resolveRemoteResult(latestJob);
    }

    if (latestJob.status === 'failed') {
      throw buildRemoteJobError(latestJob.error);
    }

    await sleep(REMOTE_JOB_POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for translation job: ${jobId}`);
}

function parseTranslationJobKey(key: string): {
  year: string;
  slug: string;
  targetLang: string;
} | null {
  const firstSeparator = key.indexOf(':');
  const lastSeparator = key.lastIndexOf(':');

  if (
    firstSeparator <= 0 ||
    lastSeparator <= firstSeparator + 1 ||
    lastSeparator >= key.length - 1
  ) {
    return null;
  }

  return {
    year: key.slice(0, firstSeparator),
    slug: key.slice(firstSeparator + 1, lastSeparator),
    targetLang: key.slice(lastSeparator + 1),
  };
}

export function buildTranslationJobKey(year: string, slug: string, targetLang: string): string {
  return `${year}:${slug}:${targetLang}`;
}

export async function startTranslationJob<T>(
  db: D1Database,
  input: StartTranslationJobInput<T>
): Promise<TranslationJobHandle<T>> {
  const existing = await fetchActiveTranslationJob(
    db,
    input.year,
    input.slug,
    input.targetLang,
    input.contentHash
  );
  const existingWait = existing
    ? (runningJobs.get(existing.id) as Promise<T> | undefined)
    : undefined;

  if (existing?.status === 'running' && existingWait) {
    return {
      created: false,
      job: existing,
      wait: existingWait,
    };
  }

  const now = new Date().toISOString();
  const lockExpiresAt = new Date(Date.now() + TRANSLATION_JOB_LEASE_TTL_MS).toISOString();
  const jobId = `translation-job-${crypto.randomUUID()}`;
  const lockToken = `translation-job-lock-${crypto.randomUUID()}`;
  const baseJob = {
    id: jobId,
    key: input.key,
    year: input.year,
    slug: input.slug,
    targetLang: input.targetLang,
    sourceLang: input.sourceLang,
    forceRefresh: Boolean(input.forceRefresh),
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    statusUrl: input.urls.statusUrl,
    cacheUrl: input.urls.cacheUrl,
    generateUrl: input.urls.generateUrl,
  } satisfies Omit<TranslationJobSnapshot, 'status'>;

  const claim = await claimTranslationJobLease(db, {
    ...baseJob,
    status: 'running',
    contentHash: input.contentHash,
    lockToken,
    lockExpiresAt,
  });

  if (!claim.acquired) {
    const remoteWait =
      (runningJobs.get(claim.job.id) as Promise<T> | undefined) ||
      waitForRemoteTranslationJob(db, claim.job.id, input.resolveRemoteResult);

    console.warn('[translation-jobs] joining existing durable job', {
      jobId: claim.job.id,
      key: claim.job.key,
      reclaimedStaleLease: claim.reclaimedStaleLease,
    });

    return {
      created: false,
      job: claim.job,
      wait: remoteWait,
    };
  }

  const job = claim.job;

  const wait = Promise.resolve()
    .then(input.runner)
    .then(async (result) => {
      const completedAt = new Date().toISOString();

      const settledJob = await settleTranslationJobLease(db, {
        id: job.id,
        lockToken,
        status: 'succeeded',
        updatedAt: completedAt,
        completedAt,
        error: undefined,
        result: input.summarizeResult ? input.summarizeResult(result) : undefined,
      });
      if (settledJob && input.onSuccess) {
        await input.onSuccess(result, settledJob);
      } else if (!settledJob) {
        console.warn('[translation-jobs] lease lost before success commit', {
          jobId: job.id,
          key: job.key,
        });
      }

      return result;
    })
    .catch(async (error) => {
      const completedAt = new Date().toISOString();
      const normalizedError = input.normalizeError
        ? input.normalizeError(error)
        : defaultJobError(error);

      const settledJob = await settleTranslationJobLease(db, {
        id: job.id,
        lockToken,
        status: 'failed',
        updatedAt: completedAt,
        completedAt,
        error: normalizedError,
        result: undefined,
      });
      if (settledJob && input.onFailure) {
        await input.onFailure(error, settledJob, normalizedError);
      } else if (!settledJob) {
        console.warn('[translation-jobs] lease lost before failure commit', {
          jobId: job.id,
          key: job.key,
        });
      }

      throw error;
    })
    .finally(() => {
      runningJobs.delete(job.id);
    });

  runningJobs.set(job.id, wait as Promise<unknown>);

  return {
    created: true,
    job,
    wait,
  };
}

export async function getTranslationJobByKey(
  db: D1Database,
  key: string,
  contentHash: string
): Promise<TranslationJobSnapshot | null> {
  const parsedKey = parseTranslationJobKey(key);
  if (!parsedKey) {
    return null;
  }

  return fetchActiveTranslationJob(
    db,
    parsedKey.year,
    parsedKey.slug,
    parsedKey.targetLang,
    contentHash
  );
}

export async function getTranslationJobById(
  db: D1Database,
  jobId: string
): Promise<TranslationJobSnapshot | null> {
  return fetchTranslationJobById(db, jobId);
}
