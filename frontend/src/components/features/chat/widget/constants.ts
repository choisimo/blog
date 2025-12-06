export const CHAT_SESSIONS_INDEX_KEY = "ai_chat_sessions_index";
export const CHAT_SESSION_STORAGE_PREFIX = "ai_chat_history_v2_";
export const CURRENT_SESSION_KEY = "ai_chat_current_session_key";
export const PERSIST_OPTIN_KEY = "ai_chat_persist_optin";

export const QUICK_PROMPTS = [
  "이 글을 3줄로 요약해줘.",
  "SEO 키워드 5개 추천해줘.",
  "블로그 글 제목 3개를 제안해줘.",
];

// Helper function to extract image URL from message text
export function extractImageFromMessage(text: string): {
  imageUrl: string | null;
  cleanText: string;
} {
  const imageUrlMatch = text.match(
    /\[첨부 이미지\]\nURL: (https?:\/\/[^\s\n]+)/,
  );
  if (imageUrlMatch) {
    const imageUrl = imageUrlMatch[1];
    // Remove the image metadata section from the text
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

// Generate a unique session key
export function generateSessionKey(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
