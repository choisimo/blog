import { Router } from "express";
import matter from "gray-matter";
import { queryOne, execute, isD1Configured } from "../lib/d1.js";
import { aiService } from "../lib/ai-service.js";
import { createLogger } from "../lib/logger.js";
import { config } from "../config.js";
import { requireUserAuth } from "../middleware/userAuth.js";
import requireAdmin from "../middleware/adminAuth.js";
import {
  buildTranslationJobKey,
  getTranslationJobById,
  getTranslationJobByKey,
  startTranslationJob,
} from "./lib/translation-jobs.js";

const router = Router();
const logger = createLogger("translate");

const SUPPORTED_LANGS = ["ko", "en"];
const LANG_NAMES = {
  ko: "Korean",
  en: "English",
};

const requireD1 = (req, res, next) => {
  if (!isD1Configured()) {
    return res.status(503).json({
      ok: false,
      error: "Translation service not configured (D1 credentials missing)",
    });
  }
  next();
};

function normalizeLang(value) {
  return SUPPORTED_LANGS.includes(value) ? value : undefined;
}

function hashContent(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function truncateForTranslation(content, maxChars = 30000) {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}\n\n[... content truncated for translation ...]`;
}

async function fetchRemoteManifest() {
  const manifestUrl = `${config.siteBaseUrl}/posts-manifest.json`;
  const response = await fetch(manifestUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }

  return response.json();
}

async function fetchPublishedPost(year, slug) {
  const manifest = await fetchRemoteManifest();
  const item = (manifest.items || []).find(
    (entry) =>
      entry.year === year && entry.slug === slug && entry.published !== false,
  );

  if (!item?.path) {
    return null;
  }

  const postUrl = `${String(config.siteBaseUrl).replace(/\/$/, "")}${item.path.startsWith("/") ? item.path : `/${item.path}`}`;
  const response = await fetch(postUrl, {
    headers: { Accept: "text/markdown, text/plain, */*" },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    return null;
  }

  const markdown = await response.text();
  const { data, content } = matter(markdown);

  return {
    year,
    slug,
    title: String(data.title || item.title || slug),
    description: String(
      data.description ||
        data.excerpt ||
        item.description ||
        item.excerpt ||
        "",
    ),
    content,
    sourceLang:
      normalizeLang(data.defaultLanguage) ||
      normalizeLang(item.defaultLanguage) ||
      normalizeLang(item.language) ||
      "ko",
  };
}

async function getCachedTranslation(year, slug, targetLang) {
  return queryOne(
    `SELECT * FROM post_translations_cache
     WHERE post_slug = ? AND year = ? AND target_lang = ?`,
    slug,
    year,
    targetLang,
  );
}

function buildCachedResponse(cached) {
  return {
    title: cached.title,
    description: cached.description || "",
    content: cached.content,
    cached: true,
    isAiGenerated: cached.is_ai_generated === 1,
    createdAt: cached.created_at,
    updatedAt: cached.updated_at,
  };
}

function summarizeTranslationResult(result) {
  return {
    source: result.cached ? "cache" : result.isAiGenerated ? "generated" : "passthrough",
    cached: result.cached,
    isAiGenerated: Boolean(result.isAiGenerated),
    translationAvailable: Boolean(result.content),
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

function normalizeTranslateError(err) {
  logger.error({}, "Translation failed", {
    error: err instanceof Error ? err.message : String(err),
  });

  const errMsg = String(err?.message || "");

  if (errMsg.includes("timed out") || errMsg.includes("timeout")) {
    return {
      status: 504,
      code: "AI_TIMEOUT",
      retryable: true,
      retryAfterSeconds: 30,
      error: "AI 번역 서버 응답 지연",
      message:
        "AI 번역 서버 응답이 30초 이내에 도착하지 않았습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  if (errMsg.includes("AI generation failed") || errMsg.includes("vas-core")) {
    return {
      status: 502,
      code: "AI_ERROR",
      retryable: true,
      retryAfterSeconds: 30,
      error: "AI 서버 오류",
      message:
        "AI 번역 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  return {
    status: 500,
    code: "UNKNOWN",
    retryable: false,
    error: err?.message || "Translation failed",
    message: err?.message || "Translation failed",
  };
}

function applyJobHeaders(res, job) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Translation-Job-Id", job.id);
  res.setHeader("Location", job.statusUrl);
}

function buildTranslationJobUrls(req, year, slug, targetLang) {
  const origin = `${req.protocol}://${req.get("host")}`;
  const basePath = `${origin}/api/v1`;
  return {
    cacheUrl: `${basePath}/public/posts/${year}/${slug}/translations/${targetLang}/cache`,
    generateUrl: `${basePath}/internal/posts/${year}/${slug}/translations/${targetLang}/generate`,
    statusUrl: `${basePath}/internal/posts/${year}/${slug}/translations/${targetLang}/generate/status`,
  };
}

function wantsAsyncResponse(req, options = {}) {
  if (options.respondAsync) {
    return true;
  }

  if (String(req.query?.async || "") === "true") {
    return true;
  }

  const prefer = String(req.get("Prefer") || "").toLowerCase();
  if (prefer.includes("respond-async")) {
    return true;
  }

  return req.get("X-Response-Mode") === "async";
}

function buildGenerateSuccessResponse(res, data, job) {
  if (job) {
    applyJobHeaders(res, job);
    return res.json({ ok: true, data, job });
  }

  return res.json({ ok: true, data });
}

async function getImmediateTranslationResult(sourcePost, targetLang, options = {}) {
  const sourceLang = normalizeLang(options.sourceLang) || sourcePost.sourceLang;

  if (!options.forceRefresh) {
    const cached = await getCachedTranslation(
      sourcePost.year,
      sourcePost.slug,
      targetLang,
    );
    const contentHash = hashContent(sourcePost.content);

    if (cached && cached.content_hash === contentHash) {
      return buildCachedResponse(cached);
    }
  }

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

async function translateAndCachePost(sourcePost, targetLang, options = {}) {
  const sourceLang = normalizeLang(options.sourceLang) || sourcePost.sourceLang;
  const contentHash = hashContent(sourcePost.content);

  if (!options.forceRefresh) {
    const cached = await getCachedTranslation(
      sourcePost.year,
      sourcePost.slug,
      targetLang,
    );

    if (cached && cached.content_hash === contentHash) {
      return buildCachedResponse(cached);
    }
  }

  if (sourceLang === targetLang) {
    return {
      title: sourcePost.title,
      description: sourcePost.description,
      content: sourcePost.content,
      cached: false,
      isAiGenerated: false,
    };
  }

  const sourceLangName = LANG_NAMES[sourceLang] || sourceLang;
  const targetLangName = LANG_NAMES[targetLang] || targetLang;

  const titlePrompt = `Translate the following blog post title from ${sourceLangName} to ${targetLangName}.
Return ONLY the translated title, nothing else.

Title: ${sourcePost.title}`;

  const translatedTitle = await aiService.generate(titlePrompt, {
    temperature: 0.1,
  });

  let translatedDescription = "";
  if (sourcePost.description) {
    const descPrompt = `Translate the following blog post description from ${sourceLangName} to ${targetLangName}.
Return ONLY the translated description, nothing else.

Description: ${sourcePost.description}`;

    translatedDescription = await aiService.generate(descPrompt, {
      temperature: 0.1,
    });
  }

  const truncatedContent = truncateForTranslation(sourcePost.content);
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
    temperature: 0.2,
  });

  const cleanTitle = translatedTitle.trim().replace(/^["']|["']$/g, "");
  const cleanDescription = translatedDescription
    .trim()
    .replace(/^["']|["']$/g, "");
  const cleanContent = translatedContent.trim();

  await execute(
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
    sourcePost.slug,
    sourcePost.year,
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
    contentHash,
  );

  return {
    title: cleanTitle,
    description: cleanDescription,
    content: cleanContent,
    cached: false,
    isAiGenerated: true,
  };
}

function handleTranslateError(res, err) {
  const details = normalizeTranslateError(err);
  if (details.retryAfterSeconds) {
    res.setHeader("Retry-After", String(details.retryAfterSeconds));
  }
  return res.status(details.status).json({
    ok: false,
    error: details.error,
    code: details.code,
    retryable: details.retryable,
    message: details.message,
  });
}

async function sendCachedTranslation(req, res) {
  try {
    const { year, slug, targetLang } = req.params;
    const normalizedTargetLang = normalizeLang(targetLang);

    if (!normalizedTargetLang) {
      return res.status(400).json({
        ok: false,
        error: `Unsupported target language: ${targetLang}`,
      });
    }

    const sourcePost = await fetchPublishedPost(year, slug);
    if (!sourcePost) {
      return res.status(404).json({
        ok: false,
        error: "Published post not found",
        code: "NOT_AVAILABLE",
      });
    }

    const cached = await getCachedTranslation(year, slug, normalizedTargetLang);
    if (!cached) {
      return res.status(404).json({
        ok: false,
        error: "Translation not found",
        code: "NOT_AVAILABLE",
      });
    }

    return res.json({
      ok: true,
      data: buildCachedResponse(cached),
    });
  } catch (err) {
    logger.error({}, "Failed to get translation", {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({
      ok: false,
      error: "Failed to get translation",
    });
  }
}

async function sendTranslationJobStatus(req, res) {
  const { year, slug, targetLang } = req.params;
  const normalizedTargetLang = normalizeLang(targetLang);

  if (!normalizedTargetLang) {
    return res.status(400).json({
      ok: false,
      error: `Unsupported target language: ${targetLang}`,
    });
  }

  const jobId = String(req.query?.jobId || "").trim();
  const key = buildTranslationJobKey(year, slug, normalizedTargetLang);
  const job = jobId ? getTranslationJobById(jobId) : getTranslationJobByKey(key);

  if (!job || job.key !== key) {
    return res.status(404).json({
      ok: false,
      error: "Translation job not found",
      code: "NOT_FOUND",
    });
  }

  applyJobHeaders(res, job);
  if (job.status === "running") {
    res.setHeader("Retry-After", "3");
  } else if (job.error?.retryAfterSeconds) {
    res.setHeader("Retry-After", String(job.error.retryAfterSeconds));
  }

  return res.json({
    ok: true,
    data: { job },
  });
}

async function handleGenerate(req, res, sourcePost, targetLang, options = {}) {
  const normalizedTargetLang = normalizeLang(targetLang);
  if (!normalizedTargetLang) {
    return res.status(400).json({
      ok: false,
      error: `Unsupported target language: ${targetLang}`,
    });
  }

  const immediate = await getImmediateTranslationResult(sourcePost, normalizedTargetLang, options);
  if (immediate) {
    return buildGenerateSuccessResponse(res, immediate);
  }

  const sourceLang = normalizeLang(options.sourceLang) || sourcePost.sourceLang;
  const urls = buildTranslationJobUrls(req, sourcePost.year, sourcePost.slug, normalizedTargetLang);
  const jobHandle = startTranslationJob({
    key: buildTranslationJobKey(sourcePost.year, sourcePost.slug, normalizedTargetLang),
    year: sourcePost.year,
    slug: sourcePost.slug,
    targetLang: normalizedTargetLang,
    sourceLang,
    forceRefresh: options.forceRefresh,
    urls,
    runner: () => translateAndCachePost(sourcePost, normalizedTargetLang, options),
    summarizeResult: summarizeTranslationResult,
    normalizeError: normalizeTranslateError,
  });

  if (wantsAsyncResponse(req, options)) {
    applyJobHeaders(res, jobHandle.job);
    res.setHeader("Retry-After", "3");
    return res.status(202).json({ ok: true, data: null, job: jobHandle.job });
  }

  try {
    const data = await jobHandle.wait;
    const latestJob = getTranslationJobById(jobHandle.job.id) || jobHandle.job;
    return buildGenerateSuccessResponse(res, data, latestJob);
  } catch (err) {
    const latestJob = getTranslationJobById(jobHandle.job.id);
    if (latestJob) {
      applyJobHeaders(res, latestJob);
    }
    return handleTranslateError(res, err);
  }
}

async function deleteCachedTranslation(req, res) {
  try {
    const { year, slug, targetLang } = req.params;
    const normalizedTargetLang = normalizeLang(targetLang);

    if (!normalizedTargetLang) {
      return res.status(400).json({
        ok: false,
        error: `Unsupported target language: ${targetLang}`,
      });
    }

    await execute(
      `DELETE FROM post_translations_cache
       WHERE post_slug = ? AND year = ? AND target_lang = ?`,
      slug,
      year,
      normalizedTargetLang,
    );

    return res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    logger.error({}, "Failed to delete translation", {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({
      ok: false,
      error: "Failed to delete translation",
    });
  }
}

router.post(
  "/internal/posts/:year/:slug/translations/:targetLang/generate",
  requireD1,
  requireUserAuth,
  async (req, res) => {
    try {
      const { year, slug, targetLang } = req.params;
      const sourcePost = await fetchPublishedPost(year, slug);

      if (!sourcePost) {
        return res.status(404).json({
          ok: false,
          error: "Published post not found",
          code: "NOT_AVAILABLE",
        });
      }

      return handleGenerate(req, res, sourcePost, targetLang, req.body || {});
    } catch (err) {
      return handleTranslateError(res, err);
    }
  },
);

router.get(
  "/internal/posts/:year/:slug/translations/:targetLang/generate/status",
  requireD1,
  requireUserAuth,
  sendTranslationJobStatus,
);

router.get(
  "/internal/posts/:year/:slug/translations/:targetLang/status",
  requireD1,
  requireUserAuth,
  sendTranslationJobStatus,
);

router.get(
  "/public/posts/:year/:slug/translations/:targetLang",
  requireD1,
  sendCachedTranslation,
);

router.get(
  "/public/posts/:year/:slug/translations/:targetLang/cache",
  requireD1,
  sendCachedTranslation,
);

router.delete(
  "/internal/posts/:year/:slug/translations/:targetLang",
  requireD1,
  requireAdmin,
  deleteCachedTranslation,
);

router.delete(
  "/internal/posts/:year/:slug/translations/:targetLang/cache",
  requireD1,
  requireAdmin,
  deleteCachedTranslation,
);

router.post("/translate", requireD1, requireUserAuth, async (req, res) => {
  const body = req.body || {};

  if (!body.year || !body.slug || !body.targetLang) {
    return res.status(400).json({
      ok: false,
      error: "year, slug, and targetLang are required",
    });
  }

  try {
    const fetchedSourcePost = await fetchPublishedPost(body.year, body.slug);
    const sourcePost =
      fetchedSourcePost ||
      (body.title && body.content
        ? {
            year: body.year,
            slug: body.slug,
            title: body.title,
            description: body.description || "",
            content: body.content,
            sourceLang: normalizeLang(body.sourceLang) || "ko",
          }
        : null);

    if (!sourcePost) {
      return res.status(404).json({
        ok: false,
        error: "Published post not found",
        code: "NOT_AVAILABLE",
      });
    }

    return handleGenerate(req, res, sourcePost, body.targetLang, body);
  } catch (err) {
    return handleTranslateError(res, err);
  }
});

router.get(
  "/translate/:year/:slug/:targetLang",
  requireD1,
  sendCachedTranslation,
);

router.get(
  "/translate/:year/:slug/:targetLang/status",
  requireD1,
  requireUserAuth,
  sendTranslationJobStatus,
);

router.delete(
  "/translate/:year/:slug/:targetLang",
  requireD1,
  requireAdmin,
  deleteCachedTranslation,
);

export default router;
