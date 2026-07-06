import { useCallback, useEffect } from "react";
import {
  buildSelectedBlockFallbackPrompt,
  createSelectedBlockAttachment,
  type SelectedBlockAttachment,
  type SelectedBlockEventPayload,
} from "@/components/features/content-selection";

type UseSelectedBlockActionsOptions = {
  openChat: (input?: {
    initialMessage?: string;
    selectedBlockAttachments?: SelectedBlockAttachment[];
  }) => void;
  send: (eventName: string, detail?: Record<string, unknown>) => void;
};

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const SELECTED_BLOCK_CONTROL_TEXT_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const WHITESPACE_PATTERN = /\s+/g;

function normalizeSelectedBlockLine(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(SELECTED_BLOCK_CONTROL_TEXT_PATTERN, " ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
  return normalized || undefined;
}

function normalizeSelectedBlockMultiline(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(/\r\n?/g, "\n")
    .replace(SELECTED_BLOCK_CONTROL_TEXT_PATTERN, " ")
    .trim();
  return normalized || undefined;
}

export function normalizeSelectedBlockEventDetail(
  detail: SelectedBlockEventPayload,
): SelectedBlockEventPayload {
  return {
    text: normalizeSelectedBlockMultiline(detail.text),
    markdown: normalizeSelectedBlockMultiline(detail.markdown),
    html: normalizeSelectedBlockMultiline(detail.html),
    title: normalizeSelectedBlockLine(detail.title),
    url: normalizeSelectedBlockLine(detail.url),
    message: normalizeSelectedBlockLine(detail.message),
    post: detail.post
      ? {
          year: normalizeSelectedBlockLine(detail.post.year),
          slug: normalizeSelectedBlockLine(detail.post.slug),
          title: normalizeSelectedBlockLine(detail.post.title),
        }
      : detail.post,
  };
}

export function getSelectedBlockTextLength(detail: SelectedBlockEventPayload): number {
  const value =
    typeof detail.markdown === "string"
      ? detail.markdown
      : typeof detail.text === "string"
        ? detail.text
        : "";
  return Math.min(value.length, 6000);
}

export function useSelectedBlockActions({
  openChat,
  send,
}: UseSelectedBlockActionsOptions) {
  const handleAsk = useCallback(
    (event: Event) => {
      const rawDetail =
        (event as CustomEvent<SelectedBlockEventPayload>).detail ?? {};
      const detail = normalizeSelectedBlockEventDetail(rawDetail);
      const attachment = createSelectedBlockAttachment(detail);
      const fallbackPrompt = attachment
        ? undefined
        : buildSelectedBlockFallbackPrompt(detail);

      if (attachment) {
        openChat({ selectedBlockAttachments: [attachment] });
      } else if (fallbackPrompt) {
        openChat({ initialMessage: fallbackPrompt });
      }

      send("fab_selected_block_chat_open", {
        hasMarkdown:
          typeof detail.markdown === "string" && Boolean(detail.markdown.trim()),
        asAttachment: Boolean(attachment),
        opened: Boolean(attachment || fallbackPrompt),
        textLength: getSelectedBlockTextLength(detail),
      });
    },
    [openChat, send],
  );

  useEffect(() => {
    window.addEventListener("aiMemo:askSelectedBlock", handleAsk as EventListener);
    return () => {
      window.removeEventListener(
        "aiMemo:askSelectedBlock",
        handleAsk as EventListener,
      );
    };
  }, [handleAsk]);
}
