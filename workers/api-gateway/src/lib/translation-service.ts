import type { Env } from '../types';
import { queryOne, execute } from './d1';
import { createAIService } from './ai-service';
import { AI_TEMPERATURES, MAX_TOKENS, TEXT_LIMITS } from '../config/defaults';

export const SUPPORTED_TRANSLATION_LANGS = ['ko', 'en'] as const;
export type SupportedTranslationLang = (typeof SUPPORTED_TRANSLATION_LANGS)[number];

const LANG_NAMES: Record<SupportedTranslationLang, string> = {
  ko: 'Korean',
  en: 'English',
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

export type SourcePost = {
  year: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  sourceLang: SupportedTranslationLang;
};

export type TranslationCache = {
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

export type TranslationResponseData = {
  title: string;
  description: string;
  content: string;
  cached: boolean;
  isAiGenerated?: boolean;
  createdAt?: string;
  updatedAt?: string;
  stale?: boolean;
  warming?: boolean;
};

export type GenerateTranslationInput = {
  year: string;
  slug: string;
  targetLang: SupportedTranslationLang;
  sourceLang: SupportedTranslationLang;
  title: string;
  description: string;
  content: string;
  forceRefresh?: boolean;
};

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
    if (colonIndex <= 0) continue;

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

export function normalizeTranslationLang(
  value?: string | null
): SupportedTranslationLang | undefined {
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

export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
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

export function normalizeComparableText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function isSuspiciousTranslation(source: string, translated: string): boolean {
  const src = normalizeComparableText(source);
  const dst = normalizeComparableText(translated);

  if (!src || !dst) return true;

  const ratio = dst.length / src.length;
  if (ratio < 0.35 || ratio > 2.8) return true;
  if (src.length > 2000 && dst.length < 300) return true;

  return false;
}

export async function fetchPublishedPost(
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
      normalizeTranslationLang(data.defaultLanguage) ||
      normalizeTranslationLang(item.defaultLanguage) ||
      normalizeTranslationLang(item.language) ||
      'ko',
  };
}

export async function getCachedTranslationRecord(
  db: D1Database,
  year: string,
  slug: string,
  targetLang: SupportedTranslationLang
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

export function buildTranslationResponse(record: TranslationCache): TranslationResponseData {
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

export async function getValidCachedTranslation(
  db: D1Database,
  sourcePost: SourcePost,
  targetLang: SupportedTranslationLang
): Promise<TranslationCache | null> {
  const cached = await getCachedTranslationRecord(db, sourcePost.year, sourcePost.slug, targetLang);
  const contentHash = hashContent(sourcePost.content);
  if (
    cached &&
    cached.content_hash === contentHash &&
    !isSuspiciousTranslation(sourcePost.content, cached.content)
  ) {
    return cached;
  }
  return null;
}

export async function translateAndCachePost(
  env: Env,
  db: D1Database,
  input: GenerateTranslationInput
): Promise<TranslationResponseData> {
  const { year, slug, targetLang, sourceLang, title, description, content } = input;
  const contentHash = hashContent(content);

  if (!input.forceRefresh) {
    const cached = await getCachedTranslationRecord(db, year, slug, targetLang);
    if (
      cached &&
      cached.content_hash === contentHash &&
      !isSuspiciousTranslation(content, cached.content)
    ) {
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

  const titlePrompt = `Translate the following blog post title from ${sourceLangName} to ${targetLangName}.\nReturn ONLY the translated title, nothing else.\n\nTitle: ${title}`;

  const translatedTitle = await aiService.generate(titlePrompt, {
    temperature: AI_TEMPERATURES.TRANSLATE,
    maxTokens: MAX_TOKENS.TRANSLATE_TITLE,
  });

  let translatedDescription = '';
  if (description) {
    const descPrompt = `Translate the following blog post description from ${sourceLangName} to ${targetLangName}.\nReturn ONLY the translated description, nothing else.\n\nDescription: ${description}`;

    translatedDescription = await aiService.generate(descPrompt, {
      temperature: AI_TEMPERATURES.TRANSLATE,
      maxTokens: MAX_TOKENS.TRANSLATE_DESC,
    });
  }

  const truncatedContent = truncateForTranslation(content);
  const contentPrompt = `You are a professional translator. Translate the following blog post content from ${sourceLangName} to ${targetLangName}.\n\nIMPORTANT RULES:\n1. Preserve ALL markdown formatting exactly (headers, code blocks, lists, links, images, etc.)\n2. Do NOT translate code snippets inside fenced code blocks\n3. Do NOT translate URLs or file paths\n4. Preserve technical terms when appropriate (with translation in parentheses if needed)\n5. Maintain the same paragraph structure\n6. Return ONLY the translated content, no explanations\n\nContent:\n${truncatedContent}`;

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
