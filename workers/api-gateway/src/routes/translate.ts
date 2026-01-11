import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { HonoEnv, Env } from '../types';
import { queryOne, execute } from '../lib/d1';
import { success, error } from '../lib/response';
import { createAIService } from '../lib/ai-service';

const app = new Hono<HonoEnv>();

// Supported languages
const SUPPORTED_LANGS = ['ko', 'en'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const LANG_NAMES: Record<SupportedLang, string> = {
  ko: 'Korean',
  en: 'English',
};

// Translation cache type
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

// Simple hash function for content comparison
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// Truncate content for translation (to stay within token limits)
function truncateForTranslation(content: string, maxChars: number = 30000): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + '\n\n[... content truncated for translation ...]';
}

/**
 * POST /api/v1/translate
 * Translate a blog post to target language
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      year: string;
      slug: string;
      targetLang: string;
      sourceLang?: string;
      title: string;
      description?: string;
      content: string;
      forceRefresh?: boolean;
    }>();

    const { year, slug, targetLang, title, description, content, forceRefresh } = body;
    const sourceLang = body.sourceLang || 'ko';
    
    console.log(`[translate] Request: ${year}/${slug} ${sourceLang} -> ${targetLang}`);

    // Validate inputs
    if (!year || !slug || !targetLang || !title || !content) {
      return error(c, 'year, slug, targetLang, title, and content are required', 400);
    }

    if (!SUPPORTED_LANGS.includes(targetLang as SupportedLang)) {
      return error(c, `Unsupported target language: ${targetLang}`, 400);
    }

    if (sourceLang === targetLang) {
      return success(c, {
        title,
        description: description || '',
        content,
        cached: false,
        message: 'Source and target languages are the same',
      });
    }

    const db = c.env.DB;
    const contentHash = hashContent(content);

    // Check cache first (unless forceRefresh)
    if (!forceRefresh) {
      const cached = await queryOne<TranslationCache>(
        db,
        `SELECT * FROM post_translations_cache 
         WHERE post_slug = ? AND year = ? AND target_lang = ?`,
        slug,
        year,
        targetLang
      );

      if (cached && cached.content_hash === contentHash) {
        return success(c, {
          title: cached.title,
          description: cached.description || '',
          content: cached.content,
          cached: true,
          isAiGenerated: cached.is_ai_generated === 1,
        });
      }
    }

    // Generate translation using AI
    const sourceLangName = LANG_NAMES[sourceLang as SupportedLang] || sourceLang;
    const targetLangName = LANG_NAMES[targetLang as SupportedLang] || targetLang;
    
    console.log(`[translate] Cache miss, calling AI for ${year}/${slug}`);

    // Create AI service instance (uses BACKEND_ORIGIN to avoid circular calls)
    const aiService = createAIService(c.env);

    // Translate title
    const titlePrompt = `Translate the following blog post title from ${sourceLangName} to ${targetLangName}. 
Return ONLY the translated title, nothing else.

Title: ${title}`;

    const translatedTitle = await aiService.generate(titlePrompt, {
      temperature: 0.1,
      maxTokens: 256,
    });

    // Translate description if provided
    let translatedDescription = '';
    if (description) {
      const descPrompt = `Translate the following blog post description from ${sourceLangName} to ${targetLangName}.
Return ONLY the translated description, nothing else.

Description: ${description}`;

      translatedDescription = await aiService.generate(descPrompt, {
        temperature: 0.1,
        maxTokens: 512,
      });
    }

    // Translate content (in chunks if necessary for very long posts)
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
      temperature: 0.2,
      maxTokens: 16000,
    });

    // Clean up the responses
    const cleanTitle = translatedTitle.trim().replace(/^["']|["']$/g, '');
    const cleanDescription = translatedDescription.trim().replace(/^["']|["']$/g, '');
    const cleanContent = translatedContent.trim();

    // Cache the translation
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

    return success(c, {
      title: cleanTitle,
      description: cleanDescription,
      content: cleanContent,
      cached: false,
      isAiGenerated: true,
    });
  } catch (err) {
    console.error('[translate] Translation failed:', err);
    const message = err instanceof Error ? err.message : 'Translation failed';
    
    // Provide more specific error messages
    let statusCode: ContentfulStatusCode = 500;
    let errorMessage = message;
    
    if (message.includes('Backend AI error')) {
      statusCode = 502;
      errorMessage = 'AI 서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    } else if (message.includes('timeout') || message.includes('TIMEOUT')) {
      statusCode = 504;
      errorMessage = 'AI 응답 지연 중입니다. 잠시 후 다시 시도해주세요.';
    }
    
    return error(c, errorMessage, statusCode);
  }
});

/**
 * GET /api/v1/translate/:year/:slug/:targetLang
 * Get cached translation for a post
 */
app.get('/:year/:slug/:targetLang', async (c) => {
  try {
    const { year, slug, targetLang } = c.req.param();
    const db = c.env.DB;

    const cached = await queryOne<TranslationCache>(
      db,
      `SELECT * FROM post_translations_cache 
       WHERE post_slug = ? AND year = ? AND target_lang = ?`,
      slug,
      year,
      targetLang
    );

    if (!cached) {
      return error(c, 'Translation not found', 404);
    }

    return success(c, {
      title: cached.title,
      description: cached.description || '',
      content: cached.content,
      cached: true,
      isAiGenerated: cached.is_ai_generated === 1,
      createdAt: cached.created_at,
      updatedAt: cached.updated_at,
    });
  } catch (err) {
    console.error('Failed to get translation:', err);
    return error(c, 'Failed to get translation', 500);
  }
});

/**
 * DELETE /api/v1/translate/:year/:slug/:targetLang
 * Delete cached translation
 */
app.delete('/:year/:slug/:targetLang', async (c) => {
  try {
    const { year, slug, targetLang } = c.req.param();
    const db = c.env.DB;

    await execute(
      db,
      `DELETE FROM post_translations_cache 
       WHERE post_slug = ? AND year = ? AND target_lang = ?`,
      slug,
      year,
      targetLang
    );

    return success(c, { deleted: true });
  } catch (err) {
    console.error('Failed to delete translation:', err);
    return error(c, 'Failed to delete translation', 500);
  }
});

export default app;
