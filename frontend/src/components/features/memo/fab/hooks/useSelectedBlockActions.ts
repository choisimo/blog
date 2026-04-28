import { useCallback, useEffect } from "react";

type SelectedBlockPayload = {
  text?: string;
  markdown?: string;
  html?: string;
  title?: string;
  url?: string;
  message?: string;
  post?: {
    year?: string;
    slug?: string;
    title?: string;
  } | null;
};

type UseSelectedBlockActionsOptions = {
  openChat: (initialMessage?: string) => void;
  send: (eventName: string, detail?: Record<string, unknown>) => void;
};

const MAX_BLOCK_CHARS = 6000;

function normalizeBlockText(detail: SelectedBlockPayload): string {
  const source = detail.markdown || detail.text || "";
  const trimmed = source.trim();
  if (trimmed.length <= MAX_BLOCK_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_BLOCK_CHARS)}\n…(truncated)`;
}

function buildSelectedBlockPrompt(detail: SelectedBlockPayload): string {
  if (detail.message?.trim()) return detail.message.trim();

  const block = normalizeBlockText(detail);
  const title = detail.title || detail.post?.title || document.title;
  const path = detail.post?.year && detail.post?.slug
    ? `${detail.post.year}/${detail.post.slug}`
    : window.location.pathname;

  return [
    "아래 선택한 블록을 현재 글의 문맥에 맞춰 설명해줘.",
    "필요하면 사용 예시, 관련 개념, 주의할 점까지 정리해줘.",
    "",
    `[현재 글] ${title}`,
    `[경로] ${path}`,
    "",
    "[선택한 블록]",
    "```md",
    block,
    "```",
  ].join("\n");
}

export function useSelectedBlockActions({
  openChat,
  send,
}: UseSelectedBlockActionsOptions) {
  const handleAsk = useCallback(
    (event: Event) => {
      const detail = (event as CustomEvent<SelectedBlockPayload>).detail ?? {};
      openChat(buildSelectedBlockPrompt(detail));
      send("fab_selected_block_chat_open", {
        hasMarkdown: Boolean(detail.markdown),
        textLength: (detail.markdown || detail.text || "").length,
      });
    },
    [openChat, send],
  );

  useEffect(() => {
    window.addEventListener("aiMemo:askSelectedBlock", handleAsk as EventListener);
    return () => {
      window.removeEventListener("aiMemo:askSelectedBlock", handleAsk as EventListener);
    };
  }, [handleAsk]);
}
