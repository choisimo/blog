import { randomUUID } from "node:crypto";

const STORE_KEY = "__blogTranslationJobStoreBackend";
const JOB_TTL_MS = 30 * 60 * 1000;

function getStore() {
  const root = globalThis;
  if (!root[STORE_KEY]) {
    root[STORE_KEY] = {
      jobsById: new Map(),
      latestJobByKey: new Map(),
    };
  }
  return root[STORE_KEY];
}

function snapshotJob(job) {
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

function pruneExpiredJobs() {
  const store = getStore();
  const now = Date.now();

  for (const [jobId, job] of store.jobsById.entries()) {
    if (job.status === "running") {
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

function defaultJobError(error) {
  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : "Translation job failed",
  };
}

export function buildTranslationJobKey(year, slug, targetLang) {
  return `${year}:${slug}:${targetLang}`;
}

export function startTranslationJob(input) {
  pruneExpiredJobs();
  const store = getStore();
  const existing = store.latestJobByKey.get(input.key);

  if (existing?.status === "running" && existing.promise) {
    return {
      created: false,
      job: snapshotJob(existing),
      wait: existing.promise,
    };
  }

  const now = new Date().toISOString();
  const job = {
    id: `translation-job-${randomUUID()}`,
    key: input.key,
    status: "running",
    year: input.year,
    slug: input.slug,
    targetLang: input.targetLang,
    sourceLang: input.sourceLang,
    forceRefresh: Boolean(input.forceRefresh),
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    statusUrl: input.statusUrl,
    cacheUrl: input.cacheUrl,
    generateUrl: input.generateUrl,
  };

  const wait = Promise.resolve()
    .then(input.runner)
    .then((result) => {
      const completedAt = new Date().toISOString();
      job.status = "succeeded";
      job.updatedAt = completedAt;
      job.completedAt = completedAt;
      job.result = input.summarizeResult
        ? input.summarizeResult(result)
        : undefined;
      return result;
    })
    .catch((error) => {
      const completedAt = new Date().toISOString();
      job.status = "failed";
      job.updatedAt = completedAt;
      job.completedAt = completedAt;
      job.error = input.normalizeError
        ? input.normalizeError(error)
        : defaultJobError(error);
      throw error;
    });

  job.promise = wait;
  store.jobsById.set(job.id, job);
  store.latestJobByKey.set(input.key, job);

  return {
    created: true,
    job: snapshotJob(job),
    wait,
  };
}

export function getTranslationJobByKey(key) {
  pruneExpiredJobs();
  const job = getStore().latestJobByKey.get(key);
  return job ? snapshotJob(job) : null;
}

export function getTranslationJobById(jobId) {
  pruneExpiredJobs();
  const job = getStore().jobsById.get(jobId);
  return job ? snapshotJob(job) : null;
}
