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
  if (typeof text !== "string") {
    return { imageUrl: null, cleanText: "" };
  }

  const imageUrlMatch = text.match(/\[첨부 이미지\]\nURL:\s*([^\s\n]+)/);
  if (imageUrlMatch) {
    let imageUrl: string | null = null;
    try {
      const parsed = new URL(imageUrlMatch[1]);
      imageUrl =
        parsed.protocol === "http:" || parsed.protocol === "https:"
          ? parsed.toString()
          : null;
    } catch {
      imageUrl = null;
    }

    if (!imageUrl) {
      return { imageUrl: null, cleanText: text };
    }

    const cleanText = text
      .replace(
        /\n\n\[첨부 이미지\]\nURL:\s*[^\n]+\n파일명:\s*[^\n]*\n크기:\s*[^\n]*/,
        "",
      )
      .trim();
    return { imageUrl, cleanText };
  }
  return { imageUrl: null, cleanText: text };
}
