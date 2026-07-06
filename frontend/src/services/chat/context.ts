/**
 * Chat Service - Context Utilities
 *
 * 페이지 컨텍스트 및 아티클 텍스트 추출 유틸리티
 */

import type { PageContext } from './types';

type ArticleContext = NonNullable<PageContext["article"]>;
const MAX_CONTEXT_METADATA_FIELD_LENGTH = 300;
const MAX_CONTEXT_HEADING_LENGTH = 160;

function truncateContextText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text || null;
}

function normalizeSingleLineText(
  value: unknown,
  maxLength = MAX_CONTEXT_METADATA_FIELD_LENGTH,
): string | null {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine ? truncateContextText(singleLine, maxLength) : null;
}

function normalizeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter((item): item is string => item !== null);
}

function readText(selector: string): string | null {
  const element = document.querySelector(selector) as HTMLElement | null;
  return normalizeText(element?.innerText);
}

function parseArticlePath(url: URL): Pick<ArticleContext, "year" | "slug"> {
  const match = url.pathname.match(/^\/blog\/(\d{4})\/([^/?#]+)/);
  if (!match) {
    return {};
  }

  return {
    year: match[1],
    slug: decodeURIComponent(match[2]),
  };
}

export function getArticleContext(): ArticleContext | null {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }

  const parsedPath = parseArticlePath(new URL(window.location.href));
  if (!parsedPath.slug) {
    return null;
  }

  const articleSnippet = getArticleTextSnippet(500);
  const articleTitle =
    readText("article h1") ||
    readText("main article h1") ||
    readText("main h1") ||
    null;
  const description =
    normalizeText(document.querySelector('meta[name="description"]')?.getAttribute("content")) ||
    normalizeText(document.querySelector('meta[property="og:description"]')?.getAttribute("content"));

  const headings = Array.from(
    document.querySelectorAll("article h2, article h3, main article h2, main article h3"),
  )
    .map((node) => normalizeText(node.textContent))
    .filter((heading): heading is string => heading !== null)
    .slice(0, 6);

  if (!articleTitle && !articleSnippet && headings.length === 0) {
    return null;
  }

    return {
      title: articleTitle || undefined,
      slug: parsedPath.slug,
      year: parsedPath.year,
    description: description || articleSnippet || undefined,
    headings: headings.length > 0 ? headings : undefined,
  };
}

export function hasArticlePageContext(): boolean {
  return getArticleContext() !== null;
}

/**
 * 현재 페이지 컨텍스트 가져오기
 */
export function getPageContext(): PageContext {
  const w = typeof window !== 'undefined' ? window : null;
  const url = normalizeText(w?.location?.href) || undefined;
  const title = normalizeText(w?.document?.title) || undefined;
  return { url, title, article: getArticleContext() || undefined };
}

/**
 * 현재 페이지의 아티클 텍스트 스니펫 추출
 *
 * @param maxChars - 최대 문자 수
 * @returns 아티클 텍스트 또는 null
 */
export function getArticleTextSnippet(maxChars = 4000): string | null {
  if (typeof document === 'undefined') return null;

  try {
    const pick = (selector: string): string | null => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return null;
      const text = (el.innerText || '').trim();
      return text && text.length > 40 ? text : null;
    };

    // 우선순위에 따라 셀렉터 시도
    const candidates = [
      'article',
      'main article',
      'article.prose',
      '.prose article',
      '.prose',
      '#content',
    ];

    for (const sel of candidates) {
      const v = pick(sel);
      if (v) {
        if (v.length <= maxChars) return v;
        return `${v.slice(0, maxChars)}\n…(truncated)`;
      }
    }

    // 폴백: body 전체
    const bodyText = (document.body?.innerText || '').trim();
    if (!bodyText) return null;
    if (bodyText.length <= maxChars) return bodyText;
    return `${bodyText.slice(0, maxChars)}\n…(truncated)`;
  } catch {
    return null;
  }
}

/**
 * 챗봇 스타일 프롬프트
 */
export const CHAT_STYLE_PROMPT = `다음 지침을 따르세요:
1. 말투는 귀엽고 상냥한 애니메이션 여캐릭터(botchi)처럼, 존댓말을 유지하고 과하지 않게 가벼운 말끝(예: ~에요, ~일까요?)과 가끔 이모지(^_^, ✨)를 섞습니다.
2. 응답은 간결하고 핵심만 전합니다.
3. [관련 블로그 문서] 섹션이 있으면, 해당 문서들의 내용을 기반으로 답변하세요. 블로그 전체에서 관련 글을 찾은 결과입니다.
4. 사용자가 특정 주제의 게시글을 찾아달라고 하면, 제공된 문서 목록에서 해당 주제와 관련된 모든 글을 나열해주세요.
5. [페이지 본문]은 사용자가 현재 보고 있는 페이지입니다. 질문이 현재 페이지와 관련된 것 같으면 참고하되, 블로그 전체에 대한 질문이면 [관련 블로그 문서]를 우선시하세요.`;

/**
 * 컨텍스트 프롬프트 생성
 */
export function buildContextPrompt(
  articleSnippet: string | null,
  pageContext?: PageContext | null,
): string {
  const article = pageContext?.article;
  const snippet = normalizeText(articleSnippet);
  const title = normalizeSingleLineText(article?.title);
  const year = normalizeSingleLineText(article?.year);
  const slug = normalizeSingleLineText(article?.slug);
  const description = normalizeSingleLineText(article?.description);
  const headings = normalizeTextList(article?.headings)
    .map((heading) => normalizeSingleLineText(heading, MAX_CONTEXT_HEADING_LENGTH))
    .filter((heading): heading is string => heading !== null);
  const metadataLines = [
    title ? `제목: ${title}` : null,
    year && slug ? `게시물: ${year}/${slug}` : null,
    description ? `설명: ${description}` : null,
    headings.length > 0
      ? `주요 섹션: ${headings.join(" | ")}`
      : null,
  ].filter((line): line is string => line !== null);

  if (!snippet && metadataLines.length === 0) return '';

  return [
    metadataLines.length > 0
      ? '사용자가 현재 읽고 있는 게시물의 핵심 정보를 함께 전달할게요.'
      : '현재 보고 있는 페이지의 본문 일부를 함께 전달할게요.',
    '이 내용을 우선 참고해서 사용자의 질문에 더 정확하게 답변해 주세요.',
    '',
    ...(metadataLines.length > 0
      ? ['[현재 게시물]', ...metadataLines, '']
      : []),
    '[페이지 본문]',
    snippet || '(본문 스니펫 없음)',
    '',
    '---',
    '',
  ].join('\n');
}

/**
 * 이미지 컨텍스트 생성
 */
export function buildImageContext(
  imageUrl: string,
  imageAnalysis: string | null | undefined,
  userText: string
): string {
  let imageContext = '';
  const normalizedImageUrl = normalizeSingleLineText(imageUrl) || "첨부 이미지";
  const normalizedImageAnalysis = normalizeText(imageAnalysis);
  const normalizedUserText = normalizeText(userText);

  if (normalizedImageAnalysis) {
    imageContext += `[첨부된 이미지 분석 결과]\n${normalizedImageAnalysis}\n\n`;
  }

  imageContext += `[이미지 링크: ${normalizedImageUrl}]`;

  if (normalizedUserText) {
    imageContext += `\n\n${normalizedUserText}`;
  }

  return imageContext;
}

/**
 * RAG 컨텍스트 프롬프트 생성
 */
export function buildRAGContextPrompt(ragContext: string | null): string {
  const context = normalizeText(ragContext);
  if (!context) return '';

  return [
    '[관련 블로그 문서]',
    '다음은 블로그 전체에서 질문과 관련된 글들을 검색한 결과입니다.',
    '이 문서들을 기반으로 답변하세요. 관련 글이 여러 개 있으면 모두 언급해주세요:',
    '',
    context,
    '',
    '---',
    '',
  ].join('\n');
}

/**
 * 사용자 메모리 컨텍스트 프롬프트 생성
 */
export function buildMemoryContextPrompt(memoryContext: string | null): string {
  const context = normalizeText(memoryContext);
  if (!context) return '';

  return [
    '[사용자 정보]',
    '다음은 이전 대화에서 파악한 사용자에 대한 정보입니다.',
    '답변 시 이 정보를 자연스럽게 활용하되, 명시적으로 언급하지는 마세요:',
    '',
    context,
    '',
    '---',
    '',
  ].join('\n');
}
