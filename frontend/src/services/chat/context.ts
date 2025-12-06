/**
 * Chat Service - Context Utilities
 *
 * 페이지 컨텍스트 및 아티클 텍스트 추출 유틸리티
 */

import type { PageContext } from './types';

/**
 * 현재 페이지 컨텍스트 가져오기
 */
export function getPageContext(): PageContext {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const url = w?.location?.href as string | undefined;
  const title = w?.document?.title as string | undefined;
  return { url, title };
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
export const CHAT_STYLE_PROMPT =
  '다음 지침을 따르세요: 말투는 귀엽고 상냥한 애니메이션 여캐릭터(botchi)처럼, 존댓말을 유지하고 과하지 않게 가벼운 말끝(예: ~에요, ~일까요?)과 가끔 이모지(^_^, ✨)를 섞습니다. 응답은 간결하고 핵심만 전합니다.';

/**
 * 컨텍스트 프롬프트 생성
 */
export function buildContextPrompt(articleSnippet: string | null): string {
  if (!articleSnippet) return '';

  return [
    '현재 보고 있는 페이지의 본문 일부를 함께 전달할게요.',
    '이 내용을 참고해서 사용자의 질문에 더 정확하게 답변해 주세요.',
    '',
    '[페이지 본문]',
    articleSnippet,
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

  if (imageAnalysis) {
    imageContext += `[첨부된 이미지 분석 결과]\n${imageAnalysis}\n\n`;
  }

  imageContext += `[이미지 링크: ${imageUrl}]\n\n`;
  imageContext += userText || '이 이미지에 대해 설명해 주세요.';

  return imageContext;
}

/**
 * RAG 컨텍스트 프롬프트 생성
 */
export function buildRAGContextPrompt(ragContext: string | null): string {
  if (!ragContext) return '';

  return [
    '[관련 블로그 문서]',
    '다음은 질문과 관련된 블로그 글입니다. 답변 시 참고하세요:',
    '',
    ragContext,
    '',
    '---',
    '',
  ].join('\n');
}

/**
 * 사용자 메모리 컨텍스트 프롬프트 생성
 */
export function buildMemoryContextPrompt(memoryContext: string | null): string {
  if (!memoryContext) return '';

  return [
    '[사용자 정보]',
    '다음은 이전 대화에서 파악한 사용자에 대한 정보입니다.',
    '답변 시 이 정보를 자연스럽게 활용하되, 명시적으로 언급하지는 마세요:',
    '',
    memoryContext,
    '',
    '---',
    '',
  ].join('\n');
}
