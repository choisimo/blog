import type { D1Database } from '@cloudflare/workers-types';

import {
  fetchActiveTranslationJob,
  fetchTranslationJobById,
  upsertTranslationJobRow,
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
  summarizeResult?: (result: T) => TranslationJobResultSummary;
  normalizeError?: (error: unknown) => TranslationJobError;
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

function parseTranslationJobKey(key: string): {
  year: string;
  slug: string;
  targetLang: string;
} | null {
  const firstSeparator = key.indexOf(':');
  const lastSeparator = key.lastIndexOf(':');

  if (firstSeparator <= 0 || lastSeparator <= firstSeparator + 1 || lastSeparator >= key.length - 1) {
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
  const existingWait = existing ? (runningJobs.get(existing.id) as Promise<T> | undefined) : undefined;

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

  const job = await upsertTranslationJobRow(db, {
    ...baseJob,
    status: 'running',
    contentHash: input.contentHash,
  });

  const wait = Promise.resolve()
    .then(input.runner)
    .then(async (result) => {
      const completedAt = new Date().toISOString();

      await upsertTranslationJobRow(db, {
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

      await upsertTranslationJobRow(db, {
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
