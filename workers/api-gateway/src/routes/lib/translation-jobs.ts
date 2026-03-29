import type { D1Database } from '@cloudflare/workers-types';

import {
  createTranslationJobRow,
  fetchActiveTranslationJob,
  fetchTranslationJobById,
  updateTranslationJobRowById,
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
  type: 'translation.generate';
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
  summarizeResult?: (result: T) => TranslationJobResultSummary;
  normalizeError?: (error: unknown) => TranslationJobError;
  awaitExisting?: (job: TranslationJobSnapshot) => Promise<T>;
};

type TranslationJobHandle<T> = {
  created: boolean;
  job: TranslationJobSnapshot;
  wait: Promise<T>;
};

const runningJobs = new Map<string, Promise<unknown>>();

function defaultJobError(error: unknown): TranslationJobError {
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Translation job failed',
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.toLowerCase().includes('unique constraint failed');
}

function getExistingJobWait<T>(
  job: TranslationJobSnapshot | null,
  awaitExisting?: (job: TranslationJobSnapshot) => Promise<T>
): Promise<T> | null {
  if (!job) return null;

  const existingWait = runningJobs.get(job.id) as Promise<T> | undefined;
  if (existingWait) {
    return existingWait;
  }

  if (awaitExisting) {
    return awaitExisting(job);
  }

  return null;
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
  const existingWait = getExistingJobWait(existing, input.awaitExisting);

  if (existing?.status === 'running' && existingWait) {
    return {
      created: false,
      job: existing,
      wait: existingWait,
    };
  }

  const now = new Date().toISOString();
  const jobId = `translation-job-${crypto.randomUUID()}`;
  const baseJob = {
    id: jobId,
    type: 'translation.generate' as const,
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

  let job: TranslationJobSnapshot;
  try {
    job = await createTranslationJobRow(db, {
      ...baseJob,
      status: 'running',
      contentHash: input.contentHash,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrent = await fetchActiveTranslationJob(
      db,
      input.year,
      input.slug,
      input.targetLang,
      input.contentHash
    );
    const concurrentWait = getExistingJobWait(concurrent, input.awaitExisting);

    if (!concurrent || !concurrentWait) {
      throw error;
    }

    return {
      created: false,
      job: concurrent,
      wait: concurrentWait,
    };
  }

  const wait = Promise.resolve()
    .then(input.runner)
    .then(async (result) => {
      const completedAt = new Date().toISOString();

      await updateTranslationJobRowById(db, {
        ...baseJob,
        id: job.id,
        status: 'succeeded',
        updatedAt: completedAt,
        completedAt,
        error: undefined,
        result: input.summarizeResult ? input.summarizeResult(result) : undefined,
        contentHash: input.contentHash,
      });

      return result;
    })
    .catch(async (error) => {
      const completedAt = new Date().toISOString();

      await updateTranslationJobRowById(db, {
        ...baseJob,
        id: job.id,
        status: 'failed',
        updatedAt: completedAt,
        completedAt,
        error: input.normalizeError ? input.normalizeError(error) : defaultJobError(error),
        result: undefined,
        contentHash: input.contentHash,
      });

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
