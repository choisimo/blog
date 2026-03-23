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

type InternalTranslationJob<T> = TranslationJobSnapshot & {
  promise?: Promise<T>;
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

type TranslationJobStore = {
  jobsById: Map<string, InternalTranslationJob<any>>;
  latestJobByKey: Map<string, InternalTranslationJob<any>>;
};

const STORE_KEY = '__blogTranslationJobStoreWorker';
const JOB_TTL_MS = 30 * 60 * 1000;

function getStore(): TranslationJobStore {
  const root = globalThis as typeof globalThis & {
    [STORE_KEY]?: TranslationJobStore;
  };

  if (!root[STORE_KEY]) {
    root[STORE_KEY] = {
      jobsById: new Map(),
      latestJobByKey: new Map(),
    };
  }

  return root[STORE_KEY]!;
}

function snapshotJob<T>(job: InternalTranslationJob<T>): TranslationJobSnapshot {
  return {
    id: job.id,
    key: job.key,
    status: job.status,
    year: job.year,
    slug: job.slug,
    targetLang: job.targetLang,
    sourceLang: job.sourceLang,
    forceRefresh: job.forceRefresh,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    statusUrl: job.statusUrl,
    cacheUrl: job.cacheUrl,
    generateUrl: job.generateUrl,
    error: job.error,
    result: job.result,
  };
}

function pruneExpiredJobs(): void {
  const store = getStore();
  const now = Date.now();

  for (const [jobId, job] of store.jobsById.entries()) {
    if (job.status === 'running') {
      continue;
    }

    const updatedAt = Date.parse(job.updatedAt || job.createdAt);
    if (!updatedAt || now - updatedAt <= JOB_TTL_MS) {
      continue;
    }

    store.jobsById.delete(jobId);
    const current = store.latestJobByKey.get(job.key);
    if (current?.id === jobId) {
      store.latestJobByKey.delete(job.key);
    }
  }
}

function defaultJobError(error: unknown): TranslationJobError {
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Translation job failed',
  };
}

export function buildTranslationJobKey(year: string, slug: string, targetLang: string): string {
  return `${year}:${slug}:${targetLang}`;
}

export function startTranslationJob<T>(
  input: StartTranslationJobInput<T>
): TranslationJobHandle<T> {
  pruneExpiredJobs();
  const store = getStore();
  const existing = store.latestJobByKey.get(input.key) as InternalTranslationJob<T> | undefined;

  if (existing?.status === 'running' && existing.promise) {
    return {
      created: false,
      job: snapshotJob(existing),
      wait: existing.promise,
    };
  }

  const now = new Date().toISOString();
  const jobId = `translation-job-${crypto.randomUUID()}`;
  const job: InternalTranslationJob<T> = {
    id: jobId,
    key: input.key,
    status: 'running',
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
  };

  const wait = Promise.resolve()
    .then(input.runner)
    .then((result) => {
      const completedAt = new Date().toISOString();
      job.status = 'succeeded';
      job.updatedAt = completedAt;
      job.completedAt = completedAt;
      job.result = input.summarizeResult ? input.summarizeResult(result) : undefined;
      return result;
    })
    .catch((error) => {
      const completedAt = new Date().toISOString();
      job.status = 'failed';
      job.updatedAt = completedAt;
      job.completedAt = completedAt;
      job.error = input.normalizeError ? input.normalizeError(error) : defaultJobError(error);
      throw error;
    });

  job.promise = wait;
  store.jobsById.set(jobId, job as InternalTranslationJob<any>);
  store.latestJobByKey.set(input.key, job as InternalTranslationJob<any>);

  return {
    created: true,
    job: snapshotJob(job),
    wait,
  };
}

export function getTranslationJobByKey(key: string): TranslationJobSnapshot | null {
  pruneExpiredJobs();
  const job = getStore().latestJobByKey.get(key);
  return job ? snapshotJob(job) : null;
}

export function getTranslationJobById(jobId: string): TranslationJobSnapshot | null {
  pruneExpiredJobs();
  const job = getStore().jobsById.get(jobId);
  return job ? snapshotJob(job) : null;
}
