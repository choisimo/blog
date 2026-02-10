import { Router } from 'express';
import { queryOne, execute, isD1Configured } from '../lib/d1.js';
import { aiService } from '../lib/ai-service.js';

const router = Router();

// Supported languages
const SUPPORTED_LANGS = ['ko', 'en'];
const LANG_NAMES = {
  ko: 'Korean',
  en: 'English',
};

// Middleware to check D1 configuration
const requireD1 = (req, res, next) => {
  if (!isD1Configured()) {
    return res.status(503).json({
      ok: false,
      error: 'Translation service not configured (D1 credentials missing)',
    });
  }
  next();
};

/**
 * Simple hash function for content comparison
 */
function hashContent(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Truncate content for translation (to stay within token limits)
 */
function truncateForTranslation(content, maxChars = 30000) {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + '\n\n[... content truncated for translation ...]';
}

/**
 * POST /api/v1/translate
 * Translate a blog post to target language
 */
router.post('/', requireD1, async (req, res, next) => {
  try {
    const { year, slug, targetLang, title, description, content, forceRefresh } = req.body || {};
    const sourceLang = req.body.sourceLang || 'ko';

    // Validate inputs
    if (!year || !slug || !targetLang || !title || !content) {
      return res.status(400).json({
        ok: false,
        error: 'year, slug, targetLang, title, and content are required',
      });
    }

    if (!SUPPORTED_LANGS.includes(targetLang)) {
      return res.status(400).json({
        ok: false,
        error: `Unsupported target language: ${targetLang}`,
      });
    }

    if (sourceLang === targetLang) {
      return res.json({
        ok: true,
        data: {
          title,
          description: description || '',
          content,
          cached: false,
          message: 'Source and target languages are the same',
        },
      });
    }

    const contentHash = hashContent(content);

    // Check cache first (unless forceRefresh)
    if (!forceRefresh) {
      const cached = await queryOne(
        `SELECT * FROM post_translations_cache 
         WHERE post_slug = ? AND year = ? AND target_lang = ?`,
        slug,
        year,
        targetLang
      );

      if (cached && cached.content_hash === contentHash) {
        return res.json({
          ok: true,
          data: {
            title: cached.title,
            description: cached.description || '',
            content: cached.content,
            cached: true,
            isAiGenerated: cached.is_ai_generated === 1,
          },
        });
      }
    }

    // Generate translation using AI
    const sourceLangName = LANG_NAMES[sourceLang] || sourceLang;
    const targetLangName = LANG_NAMES[targetLang] || targetLang;

    // Translate title
    const titlePrompt = `Translate the following blog post title from ${sourceLangName} to ${targetLangName}. 
Return ONLY the translated title, nothing else.

Title: ${title}`;

    const translatedTitle = await aiService.generate(titlePrompt, { temperature: 0.1 });

    // Translate description if provided
    let translatedDescription = '';
    if (description) {
      const descPrompt = `Translate the following blog post description from ${sourceLangName} to ${targetLangName}.
Return ONLY the translated description, nothing else.

Description: ${description}`;

      translatedDescription = await aiService.generate(descPrompt, { temperature: 0.1 });
    }

    // Translate content
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

    const translatedContent = await aiService.generate(contentPrompt, { temperature: 0.2 });

    // Clean up the responses
    const cleanTitle = translatedTitle.trim().replace(/^["']|["']$/g, '');
    const cleanDescription = translatedDescription.trim().replace(/^["']|["']$/g, '');
    const cleanContent = translatedContent.trim();

    // Cache the translation
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

    return res.json({
      ok: true,
      data: {
        title: cleanTitle,
        description: cleanDescription,
        content: cleanContent,
        cached: false,
        isAiGenerated: true,
      },
    });
  } catch (err) {
    console.error('Translation failed:', err);
    
    const errMsg = String(err?.message || '');
    
    // vas-core 타임아웃 감지
    if (errMsg.includes('timed out') || errMsg.includes('timeout')) {
      return res.status(504).json({
        ok: false,
        error: 'AI 번역 서버 응답 지연',
        code: 'AI_TIMEOUT',
        retryable: true,
        message: 'AI 번역 서버 응답이 30초 이내에 도착하지 않았습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
    
    // 기타 AI 관련 에러
    if (errMsg.includes('AI generation failed') || errMsg.includes('vas-core')) {
      return res.status(502).json({
        ok: false,
        error: 'AI 서버 오류',
        code: 'AI_ERROR',
        retryable: true,
        message: 'AI 번역 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
    
    return next(err);
  }
});

/**
 * GET /api/v1/translate/:year/:slug/:targetLang
 * Get cached translation for a post
 */
router.get('/:year/:slug/:targetLang', requireD1, async (req, res, next) => {
  try {
    const { year, slug, targetLang } = req.params;

    const cached = await queryOne(
      `SELECT * FROM post_translations_cache 
       WHERE post_slug = ? AND year = ? AND target_lang = ?`,
      slug,
      year,
      targetLang
    );

    if (!cached) {
      return res.status(404).json({ ok: false, error: 'Translation not found' });
    }

    return res.json({
      ok: true,
      data: {
        title: cached.title,
        description: cached.description || '',
        content: cached.content,
        cached: true,
        isAiGenerated: cached.is_ai_generated === 1,
        createdAt: cached.created_at,
        updatedAt: cached.updated_at,
      },
    });
  } catch (err) {
    console.error('Failed to get translation:', err);
    return next(err);
  }
});

/**
 * DELETE /api/v1/translate/:year/:slug/:targetLang
 * Delete cached translation
 */
router.delete('/:year/:slug/:targetLang', requireD1, async (req, res, next) => {
  try {
    const { year, slug, targetLang } = req.params;

    await execute(
      `DELETE FROM post_translations_cache 
       WHERE post_slug = ? AND year = ? AND target_lang = ?`,
      slug,
      year,
      targetLang
    );

    return res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    console.error('Failed to delete translation:', err);
    return next(err);
  }
});

export default router;
