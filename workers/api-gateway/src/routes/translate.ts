import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { HonoEnv } from '../types';
import { success, error } from '../lib/response';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  buildTranslationJobKey,
  getTranslationJobById,
  getTranslationJobByKey,
  startTranslationJob,
  type TranslationJobError,
  type TranslationJobResultSummary,
  type TranslationJobSnapshot,
} from './lib/translation-jobs';
import {
  buildTranslationResponse,
  fetchPublishedPost,
  getCachedTranslationRecord,
  getValidCachedTranslation,
  hashContent,
  normalizeTranslationLang,
  translateAndCachePost,
  type SourcePost,
  type SupportedTranslationLang,
  type TranslationResponseData,
} from '../lib/translation-service';
import { enqueueTranslationGeneration } from '../lib/ai-artifact-outbox';
import { ERROR_MESSAGES } from '../config/defaults';

const app = new Hono<HonoEnv>();
const LEGACY_TRANSLATE_SUNSET = 'Tue, 30 Jun 2026 00:00:00 GMT';

type GenerateOptions = {
  sourceLang?: string;
  forceRefresh?: boolean;
  respondAsync?: boolean;
};

type TranslationRequestBody = {
  year: string;
  slug: string;
  targetLang: string;
  sourceLang?: string;
  title?: string;
  description?: string;
  content?: string;
  forceRefresh?: boolean;
  respondAsync?: boolean;
};

type GenerateErrorInfo = {
  status: ContentfulStatusCode;
  code?: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
};

function summarizeTranslationResult(result: TranslationResponseData): TranslationJobResultSummary {
  return {
    source: result.cached ? 'cache' : result.isAiGenerated ? 'generated' : 'passthrough',
    cached: result.cached,
    isAiGenerated: Boolean(result.isAiGenerated),
    translationAvailable: Boolean(result.content),
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

function normalizeGenerateError(err: unknown): GenerateErrorInfo {
  const message = err instanceof Error ? err.message : 'Translation failed';

  let status: ContentfulStatusCode = 500;
  let errorMessage = message;
  let code = 'UNKNOWN';
  let retryable = false;
  let retryAfterSeconds: number | undefined;

  if (message.includes('Backend AI error')) {
    status = 502;
    errorMessage = ERROR_MESSAGES.AI_SERVER_ERROR;
    code = 'AI_ERROR';
    retryable = true;
    retryAfterSeconds = 30;
  } else if (message.includes('timeout') || message.includes('TIMEOUT')) {
    status = 504;
    errorMessage = ERROR_MESSAGES.AI_TIMEOUT;
    code = 'AI_TIMEOUT';
    retryable = true;
    retryAfterSeconds = 30;
  }

  return {
    status,
    code,
    message: errorMessage,
    retryable,
    retryAfterSeconds,
  };
}

function applyJobHeaders(c: Context<HonoEnv>, job: TranslationJobSnapshot) {
  c.header('Cache-Control', 'no-store');
  c.header('X-Translation-Job-Id', job.id);
  c.header('Location', job.statusUrl);
}

function applyLegacyRouteHeaders(c: Context<HonoEnv>, successorPath?: string) {
  c.header('Deprecation', 'true');
  c.header('Sunset', LEGACY_TRANSLATE_SUNSET);
  if (successorPath) {
    c.header('Link', `<${successorPath}>; rel="successor-version"`);
  }
}

function buildLegacySuccessorPath(
  params: { year?: string; slug?: string; targetLang?: string },
  routeType: 'generate' | 'cache' | 'status' | 'delete'
) {
  const year = params.year || '{year}';
  const slug = params.slug || '{slug}';
  const targetLang = params.targetLang || '{targetLang}';

  if (routeType === 'generate') {
    return `/api/v1/internal/posts/${year}/${slug}/translations/${targetLang}/generate`;
  }
  if (routeType === 'cache') {
    return `/api/v1/public/posts/${year}/${slug}/translations/${targetLang}/cache`;
  }
  if (routeType === 'status') {
    return `/api/v1/internal/posts/${year}/${slug}/translations/${targetLang}/generate/status`;
  }
  return `/api/v1/internal/posts/${year}/${slug}/translations/${targetLang}/cache`;
}

function markLegacyTranslateRoute(
  c: Context<HonoEnv>,
  routeType: 'generate' | 'cache' | 'status' | 'delete'
) {
  applyLegacyRouteHeaders(c, buildLegacySuccessorPath(c.req.param(), routeType));
}

function buildTranslationJobUrls(
  requestUrl: string,
  year: string,
  slug: string,
  targetLang: string
) {
  const origin = new URL(requestUrl).origin;
  const basePath = `${origin}/api/v1`;
  return {
    cacheUrl: `${basePath}/public/posts/${year}/${slug}/translations/${targetLang}/cache`,
    generateUrl: `${basePath}/internal/posts/${year}/${slug}/translations/${targetLang}/generate`,
    statusUrl: `${basePath}/internal/posts/${year}/${slug}/translations/${targetLang}/generate/status`,
  };
}

function getAuthenticatedUserId(c: Context<HonoEnv>): string | undefined {
  const user = c.get('user') as { sub?: string } | undefined;
  return typeof user?.sub === 'string' && user.sub ? user.sub : undefined;
}

async function notifyTranslationJob(
  c: Context<HonoEnv>,
  userId: string | undefined,
  jobId: string,
  urls: ReturnType<typeof buildTranslationJobUrls>,
  sourcePost: SourcePost,
  targetLang: SupportedTranslationLang,
  input: {
    type: 'success' | 'error';
    title: string;
    message: string;
  }
) {
  if (!userId || !jobId || !c.env.BACKEND_ORIGIN || !c.env.BACKEND_KEY) {
    return;
  }

  try {
    await fetch(new URL('/api/v1/notifications/outbox/internal', c.env.BACKEND_ORIGIN), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Backend-Key': c.env.BACKEND_KEY,
      },
      body: JSON.stringify({
        event: 'notification',
        type: input.type,
        title: input.title,
        message: input.message,
        userId,
        sourceId: jobId,
        payload: {
          jobId,
          resultRef: urls.cacheUrl,
          statusUrl: urls.statusUrl,
          cacheUrl: urls.cacheUrl,
          generateUrl: urls.generateUrl,
          translation: {
            year: sourcePost.year,
            slug: sourcePost.slug,
            targetLang,
          },
        },
      }),
    });
  } catch (error) {
    console.error('Failed to enqueue translation notification:', error);
  }
}

function wantsAsyncResponse(c: Context<HonoEnv>, options: GenerateOptions = {}) {
  if (options.respondAsync) {
    return true;
  }
  if (c.req.query('async') === 'true') {
    return true;
  }
  const prefer = c.req.header('Prefer') || '';
  if (prefer.toLowerCase().includes('respond-async')) {
    return true;
  }
  return c.req.header('X-Response-Mode') === 'async';
}

async function getImmediateTranslationResult(
  sourcePost: SourcePost,
  targetLang: SupportedTranslationLang,
  options: GenerateOptions = {},
  c: Context<HonoEnv>
): Promise<TranslationResponseData | null> {
  if (!options.forceRefresh) {
    const cached = await getValidCachedTranslation(c.env.DB, sourcePost, targetLang);
    if (cached) {
      return buildTranslationResponse(cached);
    }
  }

  const sourceLang = normalizeTranslationLang(options.sourceLang) || sourcePost.sourceLang;
  if (sourceLang === targetLang) {
    return {
      title: sourcePost.title,
      description: sourcePost.description,
      content: sourcePost.content,
      cached: false,
      isAiGenerated: false,
    };
  }

  return null;
}

function buildGenerateSuccessResponse(
  c: Context<HonoEnv>,
  data: TranslationResponseData,
  job?: TranslationJobSnapshot
) {
  if (job) {
    applyJobHeaders(c, job);
    return c.json({ ok: true, data, job }, 200);
  }

  return success(c, data);
}

async function handleGenerateError(c: Context<HonoEnv>, err: unknown) {
  console.error('[translate] Translation failed:', err);
  const details = normalizeGenerateError(err);

  if (details.retryAfterSeconds) {
    c.header('Retry-After', String(details.retryAfterSeconds));
  }

  return error(c, details.message, details.status, details.code);
}

async function sendCachedTranslation(c: Context<HonoEnv>) {
  try {
    const { year, slug, targetLang } = c.req.param();
    const normalizedTargetLang = normalizeTranslationLang(targetLang);

    if (!normalizedTargetLang) {
      return error(c, `Unsupported target language: ${targetLang}`, 400, 'BAD_REQUEST');
    }

    const sourcePost = await fetchPublishedPost(c.env, year, slug);
    if (!sourcePost) {
      return error(c, 'Published post not found', 404, 'NOT_AVAILABLE');
    }

    const cached = await getValidCachedTranslation(c.env.DB, sourcePost, normalizedTargetLang);
    if (cached) {
      return success(c, buildTranslationResponse(cached));
    }

    await enqueueTranslationGeneration(c.env, {
      year,
      slug,
      targetLang: normalizedTargetLang,
      priority: 'interactive',
    });

    const stale = await getCachedTranslationRecord(c.env.DB, year, slug, normalizedTargetLang);
    if (stale) {
      return success(c, {
        ...buildTranslationResponse(stale),
        stale: true,
        warming: true,
      });
    }

    c.header('Retry-After', '3');
    return c.json({ ok: true, data: null }, 202);
  } catch (err) {
    console.error('Failed to get translation:', err);
    return error(c, 'Failed to get translation', 500, 'INTERNAL_ERROR');
  }
}

async function deleteCachedTranslation(c: Context<HonoEnv>) {
  try {
    const { year, slug, targetLang } = c.req.param();
    const normalizedTargetLang = normalizeTranslationLang(targetLang);

    if (!normalizedTargetLang) {
      return error(c, `Unsupported target language: ${targetLang}`, 400, 'BAD_REQUEST');
    }

    await c.env.DB.prepare(
      `DELETE FROM post_translations_cache
       WHERE post_slug = ? AND year = ? AND target_lang = ?`
    )
      .bind(slug, year, normalizedTargetLang)
      .run();

    return success(c, { deleted: true });
  } catch (err) {
    console.error('Failed to delete translation:', err);
    return error(c, 'Failed to delete translation', 500, 'INTERNAL_ERROR');
  }
}

async function sendTranslationJobStatus(c: Context<HonoEnv>) {
  const { year, slug, targetLang } = c.req.param();
  const normalizedTargetLang = normalizeTranslationLang(targetLang);

  if (!normalizedTargetLang) {
    return error(c, `Unsupported target language: ${targetLang}`, 400, 'BAD_REQUEST');
  }

  const jobId = c.req.query('jobId');
  const key = buildTranslationJobKey(year, slug, normalizedTargetLang);
  const sourcePost = jobId ? null : await fetchPublishedPost(c.env, year, slug).catch(() => null);
  const job = jobId
    ? await getTranslationJobById(c.env.DB, jobId)
    : sourcePost
      ? await getTranslationJobByKey(c.env.DB, key, hashContent(sourcePost.content))
      : null;

  if (!job || job.key !== key) {
    return error(c, 'Translation job not found', 404, 'NOT_FOUND');
  }

  applyJobHeaders(c, job);
  if (job.status === 'running') {
    c.header('Retry-After', '3');
  } else if (job.error?.retryAfterSeconds) {
    c.header('Retry-After', String(job.error.retryAfterSeconds));
  }

  return success(c, { job });
}

async function generateFromSourcePost(
  c: Context<HonoEnv>,
  sourcePost: SourcePost,
  targetLang: string,
  options: GenerateOptions = {}
) {
  const normalizedTargetLang = normalizeTranslationLang(targetLang);
  if (!normalizedTargetLang) {
    return error(c, `Unsupported target language: ${targetLang}`, 400, 'BAD_REQUEST');
  }

  const immediate = await getImmediateTranslationResult(sourcePost, normalizedTargetLang, options, c);
  if (immediate) {
    return buildGenerateSuccessResponse(c, immediate);
  }

  const sourceLang = normalizeTranslationLang(options.sourceLang) || sourcePost.sourceLang;
  const contentHash = hashContent(sourcePost.content);
  const urls = buildTranslationJobUrls(
    c.req.url,
    sourcePost.year,
    sourcePost.slug,
    normalizedTargetLang
  );
  const userId = getAuthenticatedUserId(c);
  let jobId = '';
  const job = await startTranslationJob<TranslationResponseData>(c.env.DB, {
    key: buildTranslationJobKey(sourcePost.year, sourcePost.slug, normalizedTargetLang),
    year: sourcePost.year,
    slug: sourcePost.slug,
    targetLang: normalizedTargetLang,
    sourceLang,
    forceRefresh: options.forceRefresh,
    contentHash,
    urls,
    runner: async () => {
      try {
        const result = await translateAndCachePost(c.env, c.env.DB, {
          year: sourcePost.year,
          slug: sourcePost.slug,
          targetLang: normalizedTargetLang,
          sourceLang,
          title: sourcePost.title,
          description: sourcePost.description,
          content: sourcePost.content,
          forceRefresh: options.forceRefresh,
        });

        await notifyTranslationJob(c, userId, jobId, urls, sourcePost, normalizedTargetLang, {
          type: 'success',
          title: '번역 준비 완료',
          message: `${sourcePost.title} 번역이 준비되었습니다.`,
        });

        return result;
      } catch (err) {
        const details = normalizeGenerateError(err);
        await notifyTranslationJob(c, userId, jobId, urls, sourcePost, normalizedTargetLang, {
          type: 'error',
          title: '번역 준비 실패',
          message: details.message,
        });
        throw err;
      }
    },
    summarizeResult: summarizeTranslationResult,
    normalizeError: (err): TranslationJobError => {
      const details = normalizeGenerateError(err);
      return {
        status: details.status,
        code: details.code,
        message: details.message,
        retryable: details.retryable,
        retryAfterSeconds: details.retryAfterSeconds,
      };
    },
  });
  jobId = job.job.id;

  if (wantsAsyncResponse(c, options)) {
    applyJobHeaders(c, job.job);
    c.header('Retry-After', '3');
    return c.json({ ok: true, data: null, job: job.job }, 202);
  }

  try {
    const data = await job.wait;
    const latestJob = (await getTranslationJobById(c.env.DB, job.job.id)) || job.job;
    return buildGenerateSuccessResponse(c, data, latestJob);
  } catch (err) {
    const latestJob = await getTranslationJobById(c.env.DB, job.job.id);
    if (latestJob) {
      applyJobHeaders(c, latestJob);
    }
    return handleGenerateError(c, err);
  }
}

app.post(
  '/internal/posts/:year/:slug/translations/:targetLang/generate',
  requireAuth,
  async (c) => {
    const { year, slug, targetLang } = c.req.param();
    const body = await c.req.json<GenerateOptions>().catch(() => ({}));

    try {
      const sourcePost = await fetchPublishedPost(c.env, year, slug);
      if (!sourcePost) {
        return error(c, 'Published post not found', 404, 'NOT_AVAILABLE');
      }

      return generateFromSourcePost(c, sourcePost, targetLang, body);
    } catch (err) {
      return handleGenerateError(c, err);
    }
  }
);

app.get(
  '/internal/posts/:year/:slug/translations/:targetLang/generate/status',
  requireAuth,
  sendTranslationJobStatus
);
app.get(
  '/internal/posts/:year/:slug/translations/:targetLang/status',
  requireAuth,
  sendTranslationJobStatus
);

app.get('/public/posts/:year/:slug/translations/:targetLang', sendCachedTranslation);
app.get('/public/posts/:year/:slug/translations/:targetLang/cache', sendCachedTranslation);

app.delete(
  '/internal/posts/:year/:slug/translations/:targetLang',
  requireAdmin,
  deleteCachedTranslation
);
app.delete(
  '/internal/posts/:year/:slug/translations/:targetLang/cache',
  requireAdmin,
  deleteCachedTranslation
);

app.post('/translate', requireAuth, async (c) => {
  markLegacyTranslateRoute(c, 'generate');
  const body = await c.req
    .json<TranslationRequestBody>()
    .catch(() => ({}) as TranslationRequestBody);

  if (!body.year || !body.slug || !body.targetLang) {
    return error(c, 'year, slug, and targetLang are required', 400, 'BAD_REQUEST');
  }

  try {
    const fetchedSourcePost = await fetchPublishedPost(c.env, body.year, body.slug);
    const sourcePost =
      fetchedSourcePost ||
      (body.title && body.content
        ? {
            year: body.year,
            slug: body.slug,
            title: body.title,
            description: body.description || '',
            content: body.content,
            sourceLang: normalizeTranslationLang(body.sourceLang) || 'ko',
          }
        : null);

    if (!sourcePost) {
      return error(c, 'Published post not found', 404, 'NOT_AVAILABLE');
    }

    return generateFromSourcePost(c, sourcePost, body.targetLang, {
      sourceLang: body.sourceLang,
      forceRefresh: body.forceRefresh,
      respondAsync: body.respondAsync,
    });
  } catch (err) {
    return handleGenerateError(c, err);
  }
});

app.get('/translate/:year/:slug/:targetLang', async (c) => {
  markLegacyTranslateRoute(c, 'cache');
  return sendCachedTranslation(c);
});
app.get('/translate/:year/:slug/:targetLang/status', requireAuth, async (c) => {
  markLegacyTranslateRoute(c, 'status');
  return sendTranslationJobStatus(c);
});

app.delete('/translate/:year/:slug/:targetLang', requireAdmin, async (c) => {
  markLegacyTranslateRoute(c, 'delete');
  return deleteCachedTranslation(c);
});

export default app;
