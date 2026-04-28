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

export function useSelectedBlockActions({
  openChat,
  send,
}: UseSelectedBlockActionsOptions) {
  const handleAsk = useCallback(
    (event: Event) => {
      const detail =
        (event as CustomEvent<SelectedBlockEventPayload>).detail ?? {};
      const attachment = createSelectedBlockAttachment(detail);

      if (attachment) {
        openChat({ selectedBlockAttachments: [attachment] });
      } else {
        openChat({ initialMessage: buildSelectedBlockFallbackPrompt(detail) });
      }

      send("fab_selected_block_chat_open", {
        hasMarkdown: Boolean(detail.markdown),
        asAttachment: Boolean(attachment),
        textLength: (detail.markdown || detail.text || "").length,
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
