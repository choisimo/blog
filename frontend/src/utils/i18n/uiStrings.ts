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
      debate: "토론",
    },
    about: {
      title: "소개",
      subtitle: "소프트웨어 개발자 | 테크 열정가 | 문제 해결사",
      mission: "나의 미션",
      missionText:
        "지식을 공유하고, 유용한 도구를 만들고, 다른 개발자들의 성장을 돕는 것으로 기술 커뮤니티에 기여하고자 합니다. 지속적인 학습과 협업의 힘이 혁신을 이끈다고 믿습니다.",
      greeting: "안녕하세요, Nodove입니다 👋",
      greetingSubtitle: "혁신적인 솔루션을 만드는 데 열정적입니다",
      bio1: "저는 효율적이고 확장 가능하며 사용자 친화적인 애플리케이션을 만드는 것에 열정을 가진 소프트웨어 개발자입니다. 프론트엔드와 백엔드 기술 모두에 전문성을 갖추고 있으며, 복잡한 문제를 해결하고 아이디어를 현실로 구현하는 것을 즐깁니다.",
      bio2: "이 블로그를 통해 다양한 프로젝트와 기술에서 얻은 경험, 인사이트, 배움을 공유합니다. 최신 AI 모델, 웹 개발 프레임워크, DevOps 방법론 등 개발자들의 여정에 도움이 되는 가치 있는 콘텐츠를 제공하고자 합니다.",
      skills: "기술 스택",
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
      backToBlog: "블로그로 돌아가기",
      relatedPosts: "관련 글",
      relatedPostsDesc: "비슷한 맥락의 글을 더 읽어보세요.",
      comments: "댓글",
      commentPlaceholder: "댓글을 입력하세요...",
      noComments: "아직 댓글이 없습니다",
      share: "공유하기",
      tableOfContents: "목차",
      readingLanguage: "읽기 언어",
      translating: "번역 중...",
      aiTranslated: "AI 번역",
      translationFailed: "번역 실패",
      showingOriginal: "원본 콘텐츠를 표시합니다.",
      translationNotAvailable: "아직 준비된 번역이 없습니다.",
      translationAuthRequired: "번역 생성은 로그인 후 사용할 수 있습니다.",
      translationTimeout: "AI 서버 응답이 지연되고 있습니다.",
      translationServerError: "AI 번역 서버에서 오류가 발생했습니다.",
      translationUnknownError: "번역 중 오류가 발생했습니다.",
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
      debate: "Debate",
    },
    about: {
      title: "About Me",
      subtitle: "Software Developer | Tech Enthusiast | Problem Solver",
      mission: "My Mission",
      missionText:
        "To contribute to the tech community by sharing knowledge, creating useful tools, and helping others grow in their software development journey. I believe in continuous learning and the power of collaboration to drive innovation forward.",
      greeting: "Hi, I'm Nodove 👋",
      greetingSubtitle: "Passionate about building innovative solutions",
      bio1: "I'm a software developer with a passion for creating efficient, scalable, and user-friendly applications. With expertise in both frontend and backend technologies, I enjoy tackling complex problems and turning ideas into reality.",
      bio2: "Through this blog, I share my experiences, insights, and learnings from various projects and technologies. Whether it's about the latest AI models, web development frameworks, or DevOps practices, I aim to provide valuable content that helps fellow developers in their journey.",
      skills: "Skills & Technologies",
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
      backToBlog: "Back to Blog",
      relatedPosts: "Related Posts",
      relatedPostsDesc: "Continue reading with similar perspectives.",
      comments: "Comments",
      commentPlaceholder: "Write a comment...",
      noComments: "No comments yet",
      share: "Share",
      tableOfContents: "Table of Contents",
      readingLanguage: "Reading language",
      translating: "Translating...",
      aiTranslated: "AI Translated",
      translationFailed: "Translation Failed",
      showingOriginal: "Showing original content.",
      translationNotAvailable: "A cached translation is not available yet.",
      translationAuthRequired: "Sign in to generate a new translation.",
      translationTimeout: "The AI translation server is responding slowly.",
      translationServerError: "The AI translation server returned an error.",
      translationUnknownError: "Something went wrong while translating.",
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
