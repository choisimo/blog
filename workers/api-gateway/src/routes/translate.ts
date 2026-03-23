import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { HonoEnv, Env } from '../types';
import { queryOne, execute } from '../lib/d1';
import { success, error } from '../lib/response';
import { createAIService } from '../lib/ai-service';
import { AI_TEMPERATURES, MAX_TOKENS, TEXT_LIMITS, ERROR_MESSAGES } from '../config/defaults';
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

const app = new Hono<HonoEnv>();

const SUPPORTED_LANGS = ['ko', 'en'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const LANG_NAMES: Record<SupportedLang, string> = {
  ko: 'Korean',
  en: 'English',
};

type TranslationCache = {
  id: number;
  post_slug: string;
  year: string;
  source_lang: string;
  target_lang: string;
  title: string;
  description: string | null;
  content: string;
  content_hash: string;
  is_ai_generated: number;
  created_at: string;
  updated_at: string;
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

type GenerateOptions = {
  sourceLang?: string;
  forceRefresh?: boolean;
  respondAsync?: boolean;
};

type ManifestItem = {
  path?: string;
  year?: string;
  slug?: string;
  title?: string;
  description?: string;
  excerpt?: string;
  published?: boolean;
  language?: string;
  defaultLanguage?: string;
};

type SourcePost = {
  year: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  sourceLang: SupportedLang;
};

type GenerateTranslationInput = {
  year: string;
  slug: string;
  targetLang: SupportedLang;
  sourceLang: SupportedLang;
  title: string;
  description: string;
  content: string;
  forceRefresh?: boolean;
};

type TranslationResponseData = {
  title: string;
  description: string;
  content: string;
  cached: boolean;
  isAiGenerated?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type GenerateErrorInfo = {
  status: ContentfulStatusCode;
  code?: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
};

function normalizeLang(value?: string | null): SupportedLang | undefined {
  if (value === 'ko' || value === 'en') {
    return value;
  }
  return undefined;
}

function getPublicSiteUrl(env: Env): string {
  return String(
    env.PUBLIC_SITE_URL || env.OAUTH_REDIRECT_BASE_URL || 'https://noblog.nodove.com'
  ).replace(/\/$/, '');
}

function parseFrontmatter(markdown: string): {
  data: Record<string, string>;
  content: string;
} {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) {
    return { data: {}, content: markdown };
  }

  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex <= 0) {
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }

  return {
    data,
    content: markdown.slice(match[0].length),
  };
}

async function fetchPublishedPost(
  env: Env,
  year: string,
  slug: string
): Promise<SourcePost | null> {
  const siteUrl = getPublicSiteUrl(env);
  const manifestResponse = await fetch(`${siteUrl}/posts-manifest.json`, {
    headers: { Accept: 'application/json' },
  });

  if (!manifestResponse.ok) {
    throw new Error(`Failed to load posts manifest: ${manifestResponse.status}`);
  }

  const manifest = (await manifestResponse.json()) as { items?: ManifestItem[] };
  const item = manifest.items?.find(
    (entry) => entry.year === year && entry.slug === slug && entry.published !== false
  );

  if (!item?.path) {
    return null;
  }

  const normalizedPath = item.path.startsWith('/') ? item.path : `/${item.path}`;
  const markdownResponse = await fetch(`${siteUrl}${normalizedPath}`, {
    headers: { Accept: 'text/markdown, text/plain, */*' },
  });

  if (!markdownResponse.ok) {
    return null;
  }

  const markdown = await markdownResponse.text();
  const { data, content } = parseFrontmatter(markdown);

  return {
    year,
    slug,
    title: data.title || item.title || slug,
    description: data.description || data.excerpt || item.description || item.excerpt || '',
    content,
    sourceLang:
      normalizeLang(data.defaultLanguage) ||
      normalizeLang(item.defaultLanguage) ||
      normalizeLang(item.language) ||
      'ko',
  };
}

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function truncateForTranslation(
  content: string,
  maxChars: number = TEXT_LIMITS.TRANSLATE_CONTENT
): string {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}\n\n[... content truncated for translation ...]`;
}

async function getCachedTranslationRecord(
  db: D1Database,
  year: string,
  slug: string,
  targetLang: SupportedLang
): Promise<TranslationCache | null> {
  return queryOne<TranslationCache>(
    db,
    `SELECT * FROM post_translations_cache
     WHERE post_slug = ? AND year = ? AND target_lang = ?`,
    slug,
    year,
    targetLang
  );
}

function buildTranslationResponse(record: TranslationCache): TranslationResponseData {
  return {
    title: record.title,
    description: record.description || '',
    content: record.content,
    cached: true,
    isAiGenerated: record.is_ai_generated === 1,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

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
  db: D1Database,
  sourcePost: SourcePost,
  targetLang: SupportedLang,
  options: GenerateOptions = {}
): Promise<TranslationResponseData | null> {
  const normalizedSourceLang = normalizeLang(options.sourceLang) || sourcePost.sourceLang;

  if (!options.forceRefresh) {
    const cached = await getCachedTranslationRecord(db, sourcePost.year, sourcePost.slug, targetLang);
    const contentHash = hashContent(sourcePost.content);
    if (cached && cached.content_hash === contentHash) {
      return buildTranslationResponse(cached);
    }
  }

  if (normalizedSourceLang === targetLang) {
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

async function translateAndCachePost(env: Env, db: D1Database, input: GenerateTranslationInput) {
  const { year, slug, targetLang, sourceLang, title, description, content } = input;
  const contentHash = hashContent(content);

  if (!input.forceRefresh) {
    const cached = await getCachedTranslationRecord(db, year, slug, targetLang);
    if (cached && cached.content_hash === contentHash) {
      return buildTranslationResponse(cached);
    }
  }

  if (sourceLang === targetLang) {
    return {
      title,
      description,
      content,
      cached: false,
      isAiGenerated: false,
    };
  }

  const sourceLangName = LANG_NAMES[sourceLang] || sourceLang;
  const targetLangName = LANG_NAMES[targetLang] || targetLang;
  const aiService = createAIService(env);

  const titlePrompt = `Translate the following blog post title from ${sourceLangName} to ${targetLangName}.
Return ONLY the translated title, nothing else.

Title: ${title}`;

  const translatedTitle = await aiService.generate(titlePrompt, {
    temperature: AI_TEMPERATURES.TRANSLATE,
    maxTokens: MAX_TOKENS.TRANSLATE_TITLE,
  });

  let translatedDescription = '';
  if (description) {
    const descPrompt = `Translate the following blog post description from ${sourceLangName} to ${targetLangName}.
Return ONLY the translated description, nothing else.

Description: ${description}`;

    translatedDescription = await aiService.generate(descPrompt, {
      temperature: AI_TEMPERATURES.TRANSLATE,
      maxTokens: MAX_TOKENS.TRANSLATE_DESC,
    });
  }

  const truncatedContent = truncateForTranslation(content);
  const contentPrompt = `You are a professional translator. Translate the following blog post content from ${sourceLangName} to ${targetLangName}.

IMPORTANT RULES:
1. Preserve ALL markdown formatting exactly (headers, code blocks, lists, links, images, etc.)
2. Do NOT translate code snippets inside \`\`\` blocks
3. Do NOT translate URLs or file paths
4. Preserve technical terms when appropriate (with translation in parentheses if needed)
5. Maintain the same paragraph structure
6. Return ONLY the translated content, no explanations

Content:
${truncatedContent}`;

  const translatedContent = await aiService.generate(contentPrompt, {
    temperature: AI_TEMPERATURES.TRANSLATE_CONTENT,
    maxTokens: MAX_TOKENS.TRANSLATE_CONTENT,
  });

  const cleanTitle = translatedTitle.trim().replace(/^["']|["']$/g, '');
  const cleanDescription = translatedDescription.trim().replace(/^["']|["']$/g, '');
  const cleanContent = translatedContent.trim();

  await execute(
    db,
    `INSERT INTO post_translations_cache
       (post_slug, year, source_lang, target_lang, title, description, content, content_hash, is_ai_generated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(post_slug, year, target_lang)
     DO UPDATE SET
       source_lang = ?,
       title = ?,
       description = ?,
       content = ?,
       content_hash = ?,
       is_ai_generated = 1,
       updated_at = datetime('now')`,
    slug,
    year,
    sourceLang,
    targetLang,
    cleanTitle,
    cleanDescription,
    cleanContent,
    contentHash,
    sourceLang,
    cleanTitle,
    cleanDescription,
    cleanContent,
    contentHash
  );

  return {
    title: cleanTitle,
    description: cleanDescription,
    content: cleanContent,
    cached: false,
    isAiGenerated: true,
  };
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
    const normalizedTargetLang = normalizeLang(targetLang);

    if (!normalizedTargetLang) {
      return error(c, `Unsupported target language: ${targetLang}`, 400, 'BAD_REQUEST');
    }

    const sourcePost = await fetchPublishedPost(c.env, year, slug);
    if (!sourcePost) {
      return error(c, 'Published post not found', 404, 'NOT_AVAILABLE');
    }

    const cached = await getCachedTranslationRecord(c.env.DB, year, slug, normalizedTargetLang);

    if (!cached) {
      return error(c, 'Translation not found', 404, 'NOT_AVAILABLE');
    }

    return success(c, buildTranslationResponse(cached));
  } catch (err) {
    console.error('Failed to get translation:', err);
    return error(c, 'Failed to get translation', 500, 'INTERNAL_ERROR');
  }
}

async function deleteCachedTranslation(c: Context<HonoEnv>) {
  try {
    const { year, slug, targetLang } = c.req.param();
    const normalizedTargetLang = normalizeLang(targetLang);

    if (!normalizedTargetLang) {
      return error(c, `Unsupported target language: ${targetLang}`, 400, 'BAD_REQUEST');
    }

    await execute(
      c.env.DB,
      `DELETE FROM post_translations_cache
       WHERE post_slug = ? AND year = ? AND target_lang = ?`,
      slug,
      year,
      normalizedTargetLang
    );

    return success(c, { deleted: true });
  } catch (err) {
    console.error('Failed to delete translation:', err);
    return error(c, 'Failed to delete translation', 500, 'INTERNAL_ERROR');
  }
}

async function sendTranslationJobStatus(c: Context<HonoEnv>) {
  const { year, slug, targetLang } = c.req.param();
  const normalizedTargetLang = normalizeLang(targetLang);

  if (!normalizedTargetLang) {
    return error(c, `Unsupported target language: ${targetLang}`, 400, 'BAD_REQUEST');
  }

  const jobId = c.req.query('jobId');
  const key = buildTranslationJobKey(year, slug, normalizedTargetLang);
  const job = jobId ? getTranslationJobById(jobId) : getTranslationJobByKey(key);

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
  const normalizedTargetLang = normalizeLang(targetLang);
  if (!normalizedTargetLang) {
    return error(c, `Unsupported target language: ${targetLang}`, 400, 'BAD_REQUEST');
  }

  const immediate = await getImmediateTranslationResult(c.env.DB, sourcePost, normalizedTargetLang, options);
  if (immediate) {
    return buildGenerateSuccessResponse(c, immediate);
  }

  const normalizedSourceLang = normalizeLang(options.sourceLang) || sourcePost.sourceLang;
  const urls = buildTranslationJobUrls(c.req.url, sourcePost.year, sourcePost.slug, normalizedTargetLang);
  const job = startTranslationJob<TranslationResponseData>({
    key: buildTranslationJobKey(sourcePost.year, sourcePost.slug, normalizedTargetLang),
    year: sourcePost.year,
    slug: sourcePost.slug,
    targetLang: normalizedTargetLang,
    sourceLang: normalizedSourceLang,
    forceRefresh: options.forceRefresh,
    urls,
    runner: () =>
      translateAndCachePost(c.env, c.env.DB, {
        year: sourcePost.year,
        slug: sourcePost.slug,
        targetLang: normalizedTargetLang,
        sourceLang: normalizedSourceLang,
        title: sourcePost.title,
        description: sourcePost.description,
        content: sourcePost.content,
        forceRefresh: options.forceRefresh,
      }),
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

  if (wantsAsyncResponse(c, options)) {
    applyJobHeaders(c, job.job);
    c.header('Retry-After', '3');
    return c.json({ ok: true, data: null, job: job.job }, 202);
  }

  try {
    const data = await job.wait;
    const latestJob = getTranslationJobById(job.job.id) || job.job;
    return buildGenerateSuccessResponse(c, data, latestJob);
  } catch (err) {
    const latestJob = getTranslationJobById(job.job.id);
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

app.get('/internal/posts/:year/:slug/translations/:targetLang/generate/status', requireAuth, sendTranslationJobStatus);
app.get('/internal/posts/:year/:slug/translations/:targetLang/status', requireAuth, sendTranslationJobStatus);

app.get('/public/posts/:year/:slug/translations/:targetLang', sendCachedTranslation);
app.get('/public/posts/:year/:slug/translations/:targetLang/cache', sendCachedTranslation);

app.delete('/internal/posts/:year/:slug/translations/:targetLang', requireAdmin, deleteCachedTranslation);
app.delete('/internal/posts/:year/:slug/translations/:targetLang/cache', requireAdmin, deleteCachedTranslation);

app.post('/translate', requireAuth, async (c) => {
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
            sourceLang: normalizeLang(body.sourceLang) || 'ko',
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

app.get('/translate/:year/:slug/:targetLang', sendCachedTranslation);
app.get('/translate/:year/:slug/:targetLang/status', requireAuth, sendTranslationJobStatus);

app.delete('/translate/:year/:slug/:targetLang', requireAdmin, deleteCachedTranslation);

export default app;
