export {
  SESSIONS_INDEX_KEY as CHAT_SESSIONS_INDEX_KEY,
  SESSION_MESSAGES_PREFIX as CHAT_SESSION_STORAGE_PREFIX,
  SESSION_ID_KEY as CURRENT_SESSION_KEY,
  PERSIST_OPTIN_KEY,
  generateLocalSessionId as generateSessionKey,
} from "@/services/chat";

export const QUICK_PROMPTS = [
  "이 글을 3줄로 요약해줘.",
  "SEO 키워드 5개 추천해줘.",
  "블로그 글 제목 3개를 제안해줘.",
];

export function extractImageFromMessage(text: string): {
  imageUrl: string | null;
  cleanText: string;
} {
  const imageUrlMatch = text.match(
    /\[첨부 이미지\]\nURL: (https?:\/\/[^\s\n]+)/,
  );
  if (imageUrlMatch) {
    const imageUrl = imageUrlMatch[1];
    const cleanText = text
      .replace(
        /\n\n\[첨부 이미지\]\nURL: [^\n]+\n파일명: [^\n]+\n크기: [^\n]+/,
        "",
      )
      .trim();
    return { imageUrl, cleanText };
  }
  return { imageUrl: null, cleanText: text };
}
