import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { HonoEnv, Env } from '../types';
import { queryOne, execute } from '../lib/d1';
import { success, error } from '../lib/response';
import { createAIService } from '../lib/ai-service';
import { AI_TEMPERATURES, MAX_TOKENS, TEXT_LIMITS, ERROR_MESSAGES } from '../config/defaults';
import { requireAuth, requireAdmin } from '../middleware/auth';

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
};

type GenerateOptions = {
  sourceLang?: string;
  forceRefresh?: boolean;
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

function buildTranslationResponse(record: TranslationCache) {
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
  const message = err instanceof Error ? err.message : 'Translation failed';

  let statusCode: ContentfulStatusCode = 500;
  let errorMessage = message;

  if (message.includes('Backend AI error')) {
    statusCode = 502;
    errorMessage = ERROR_MESSAGES.AI_SERVER_ERROR;
  } else if (message.includes('timeout') || message.includes('TIMEOUT')) {
    statusCode = 504;
    errorMessage = ERROR_MESSAGES.AI_TIMEOUT;
  }

  if (statusCode === 502 || statusCode === 504) {
    c.header('Retry-After', '30');
  }

  return error(c, errorMessage, statusCode);
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

  const normalizedSourceLang = normalizeLang(options.sourceLang) || sourcePost.sourceLang;

  try {
    const data = await translateAndCachePost(c.env, c.env.DB, {
      year: sourcePost.year,
      slug: sourcePost.slug,
      targetLang: normalizedTargetLang,
      sourceLang: normalizedSourceLang,
      title: sourcePost.title,
      description: sourcePost.description,
      content: sourcePost.content,
      forceRefresh: options.forceRefresh,
    });

    return success(c, data);
  } catch (err) {
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

app.get('/public/posts/:year/:slug/translations/:targetLang', async (c) => {
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
    return error(c, 'Failed to get translation', 500);
  }
});

app.delete('/internal/posts/:year/:slug/translations/:targetLang', requireAdmin, async (c) => {
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
    return error(c, 'Failed to delete translation', 500);
  }
});

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
    });
  } catch (err) {
    return handleGenerateError(c, err);
  }
});

app.get('/translate/:year/:slug/:targetLang', async (c) => {
  const { year, slug, targetLang } = c.req.param();
  return app.fetch(
    new Request(
      new URL(`/public/posts/${year}/${slug}/translations/${targetLang}`, c.req.url).toString(),
      { method: 'GET', headers: c.req.raw.headers }
    ),
    c.env,
    c.executionCtx
  );
});

app.delete('/translate/:year/:slug/:targetLang', requireAdmin, async (c) => {
  const { year, slug, targetLang } = c.req.param();
  return app.fetch(
    new Request(
      new URL(`/internal/posts/${year}/${slug}/translations/${targetLang}`, c.req.url).toString(),
      { method: 'DELETE', headers: c.req.raw.headers }
    ),
    c.env,
    c.executionCtx
  );
});

export default app;
