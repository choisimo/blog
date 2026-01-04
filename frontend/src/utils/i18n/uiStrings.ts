import { useLanguage } from "@/contexts/LanguageContext";

/**
 * UI 문자열 다국어 사전
 * 새로운 문자열 추가 시 ko/en 모두에 동일한 키를 추가해야 합니다.
 */
const dictionary = {
  ko: {
    nav: {
      chat: "채팅",
      memo: "메모",
      stack: "스택",
      insight: "인사이트",
    },
    about: {
      title: "소개",
      mission: "나의 미션",
      greeting: "안녕하세요, Nodove입니다",
      connect: "연락하기",
    },
    common: {
      submit: "전송",
      cancel: "취소",
      back: "뒤로가기",
      close: "닫기",
      loading: "로딩 중...",
      error: "오류가 발생했습니다",
      retry: "다시 시도",
      save: "저장",
      delete: "삭제",
      edit: "수정",
      confirm: "확인",
    },
    blog: {
      relatedPosts: "관련 글",
      comments: "댓글",
      commentPlaceholder: "댓글을 입력하세요...",
      noComments: "아직 댓글이 없습니다",
      share: "공유하기",
      tableOfContents: "목차",
    },
    stack: {
      unavailable: "이 브라우저에서는 Stack 기능을 사용할 수 없습니다.",
      noVisited: "최근 방문한 글이 없습니다.",
      title: "Stack 사용 불가",
    },
  },
  en: {
    nav: {
      chat: "Chat",
      memo: "Memo",
      stack: "Stack",
      insight: "Insight",
    },
    about: {
      title: "About Me",
      mission: "My Mission",
      greeting: "Hi, I'm Nodove",
      connect: "Connect with me",
    },
    common: {
      submit: "Submit",
      cancel: "Cancel",
      back: "Back",
      close: "Close",
      loading: "Loading...",
      error: "An error occurred",
      retry: "Retry",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      confirm: "OK",
    },
    blog: {
      relatedPosts: "Related Posts",
      comments: "Comments",
      commentPlaceholder: "Write a comment...",
      noComments: "No comments yet",
      share: "Share",
      tableOfContents: "Table of Contents",
    },
    stack: {
      unavailable: "Stack is not available in this browser.",
      noVisited: "No recently visited posts.",
      title: "Stack Unavailable",
    },
  },
} as const;

export type UIStrings = (typeof dictionary)["ko"];
export type SupportedLanguage = keyof typeof dictionary;

/**
 * 현재 언어에 맞는 UI 문자열을 반환하는 훅
 * @returns 현재 언어의 UI 문자열 객체
 *
 * @example
 * const str = useUIStrings();
 * <button>{str.common.submit}</button>
 * <span>{str.nav.chat}</span>
 */
export function useUIStrings(): UIStrings {
  const { language } = useLanguage();
  return dictionary[language] || dictionary.en;
}

/**
 * 특정 언어의 UI 문자열을 반환하는 함수 (훅 외부에서 사용)
 * @param language 언어 코드
 * @returns 해당 언어의 UI 문자열 객체
 */
export function getUIStrings(language: SupportedLanguage): UIStrings {
  return dictionary[language] || dictionary.en;
}
