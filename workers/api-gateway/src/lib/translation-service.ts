import type { Env } from '../types';
import { queryOne } from './d1';
import { checkpointTranslation, markTranslationStage, commitTranslationCache, type TranslationJobRow } from './translation-job-repository';
import { normalizeTranslationSlug } from '../../../../shared/src/contracts/translation-path.js';
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
  source_version?: string | null;
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
  execution?: TranslationJobRow;
  deadlineMs?: number;
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

export const TRANSLATION_VERSION = 'a02-checkpoint-v1';
export async function translationSourceVersion(source: SourcePost, targetLang: SupportedTranslationLang): Promise<string> {
  const value = JSON.stringify([TRANSLATION_VERSION, source.year, source.slug, source.title, source.description,
    source.content, source.sourceLang, targetLang]);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return `sha256:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2,'0')).join('')}`;
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

function sourceUnavailable(): Error {
  return Object.assign(new Error('Published source is temporarily unavailable'), {
    status: 503, code: 'SOURCE_UNAVAILABLE',
  });
}
async function fetchSourceResponse(url: string, accept: string): Promise<Response> {
  try {
    const response = await fetch(url, {
      headers: { Accept: accept, 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw sourceUnavailable();
    }
    return response;
  } catch { throw sourceUnavailable(); }
}

export async function fetchPublishedPost(
  env: Env,
  year: string,
  slug: string
): Promise<SourcePost | null> {
  if (!/^\d{4}$/.test(year)) throw Object.assign(new Error('Invalid year'), {status:400,code:'BAD_REQUEST'});
  slug = normalizeTranslationSlug(slug, false);
  const siteUrl = getPublicSiteUrl(env);
  const manifestResponse = await fetchSourceResponse(`${siteUrl}/posts-manifest.json`, 'application/json');
  let manifest: { items: ManifestItem[] };
  try {
    manifest = await manifestResponse.json() as { items: ManifestItem[] };
    if (!manifest || !Array.isArray(manifest.items)) throw sourceUnavailable();
  } catch { throw sourceUnavailable(); }
  const item = manifest.items?.find(
    (entry) => entry && entry.year === year && typeof entry.slug === 'string' && entry.slug.normalize('NFC') === slug && entry.published !== false
  );

  if (!item?.path) {
    return null;
  }

  const normalizedPath = item.path.startsWith('/') ? item.path : `/${item.path}`;
  if (normalizedPath.startsWith('//') || /[\\\u0000-\u001f]/.test(normalizedPath) || normalizedPath.split('/').some(part => {
    try { const decoded=decodeURIComponent(part); return decoded==='.' || decoded==='..' || /[/\\%]/.test(decoded); } catch { return true; }
  }) || !/\.md$/i.test(normalizedPath)) throw new Error('Invalid published source path');
  const markdownResponse = await fetchSourceResponse(`${siteUrl}${normalizedPath}`, 'text/markdown, text/plain');
  let markdown: string;
  try { markdown = await markdownResponse.text(); } catch { throw sourceUnavailable(); }
  if (markdownResponse.headers.get('Content-Type')?.includes('text/html') || /^\s*<!doctype html|^\s*<html/i.test(markdown)) {
    throw Object.assign(new Error('Source origin returned an HTML shell'), {status:503,code:'SOURCE_UNAVAILABLE'});
  }
  const { data, content } = parseFrontmatter(markdown);

  return {
    year,
    slug,
    title: data.title || item.title || slug,
    description: data.description || data.excerpt || item.description || item.excerpt || '',
    content,
    sourceLang:
      normalizeTranslationLang(data.defaultLanguage) ||
      normalizeTranslationLang(data.language) ||
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
  const sourceVersion = await translationSourceVersion(sourcePost, targetLang);
  if (
    cached &&
    cached.source_version === sourceVersion &&
    !isSuspiciousTranslation(sourcePost.content, cached.content)
  ) {
    return cached;
  }
  return null;
}

export async function translateAndCachePost(
  env: Env, db: D1Database, input: GenerateTranslationInput
): Promise<TranslationResponseData> {
  const { title, description, content, sourceLang, targetLang, execution: job } = input;
  if (!job) throw new Error('Translation execution lease is required');
  const source: SourcePost = {year: input.year, slug: input.slug, title,description,content,sourceLang};
  if (await translationSourceVersion(source,targetLang) !== job.source_version) {
    throw Object.assign(new Error('Source changed'), {code:'SUPERSEDED'});
  }
  // A04 will provide structural block translation. Until then fail before billing, never truncate.
  if (content.length > TEXT_LIMITS.TRANSLATE_CONTENT) {
    throw Object.assign(new Error('Full article requires block translation'), {code:'CONTENT_TOO_LONG'});
  }
  const checkpoint = JSON.parse(job.checkpoint_json || '{}') as Record<string,string>;
  const aiService = createAIService(env, job.id);
  const deadline = input.deadlineMs || Date.now()+240_000;
  const languages = `${LANG_NAMES[sourceLang]} to ${LANG_NAMES[targetLang]}`;
  const stage = async (name: 'title'|'description'|'content', prompt: string, maxTokens: number) => {
    if (typeof checkpoint[name] === 'string') return checkpoint[name];
    if (Date.now() >= deadline) throw Object.assign(new Error('Execution budget exhausted before submission'), {code:'EXECUTOR_DEADLINE'});
    await markTranslationStage(db,job,name);
    const raw = await aiService.generate(prompt, {
      temperature: AI_TEMPERATURES.TRANSLATE, maxTokens,
      timeout: Math.max(1,deadline-Date.now()), idempotencyKey:`${job.id}:${name}`,
    });
    const result = typeof raw==='string' ? raw.trim() : '';
    if (!result || (name==='content' && isSuspiciousTranslation(content,result))) {
      throw Object.assign(new Error('Incomplete translation output'), {code:'INVALID_TRANSLATION'});
    }
    checkpoint[name]=result;
    await checkpointTranslation(db,job,checkpoint);
    return result;
  };
  const translatedTitle = await stage('title', `Translate the following blog post title from ${languages}. Return ONLY the translated title.\n\nTitle: ${title}`,MAX_TOKENS.TRANSLATE_TITLE);
  const translatedDescription = description
    ? await stage('description',`Translate the following blog post description from ${languages}. Return ONLY the translated description.\n\nDescription: ${description}`,MAX_TOKENS.TRANSLATE_DESC) : '';
  const translatedContent = await stage('content',`Translate the complete blog post from ${languages}. Preserve ALL Markdown formatting, fenced code, links, image URLs, tables and footnotes. Do not translate code or URLs. Do not summarize or omit paragraphs. Return ONLY the translated content.\n\nContent:\n${content}`,MAX_TOKENS.TRANSLATE_CONTENT);
  const current=await fetchPublishedPost(env,input.year,input.slug);
  if (!current || await translationSourceVersion(current,targetLang)!==job.source_version) {
    throw Object.assign(new Error('Source is no longer current or public'), {code:'SUPERSEDED'});
  }
  const value={title:translatedTitle,description:translatedDescription,content:translatedContent,cached:false,isAiGenerated:true};
  await commitTranslationCache(db,job,value);
  return value;
}
