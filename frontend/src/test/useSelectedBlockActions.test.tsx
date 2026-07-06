import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSelectedBlockActions } from "@/components/features/memo/fab/hooks/useSelectedBlockActions";

function Harness({
  openChat,
  send,
}: {
  openChat: Parameters<typeof useSelectedBlockActions>[0]["openChat"];
  send: Parameters<typeof useSelectedBlockActions>[0]["send"];
}) {
  useSelectedBlockActions({ openChat, send });
  return null;
}

describe("useSelectedBlockActions", () => {
  it("does not open chat for empty selected-block events", () => {
    const openChat = vi.fn();
    const send = vi.fn();

    render(<Harness openChat={openChat} send={send} />);

    window.dispatchEvent(
      new CustomEvent("aiMemo:askSelectedBlock", {
        detail: {
          markdown: "   ",
          message: "\u0000",
        },
      }),
    );

    expect(openChat).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      "fab_selected_block_chat_open",
      expect.objectContaining({
        hasMarkdown: false,
        asAttachment: false,
        opened: false,
        textLength: 3,
      }),
    );
  });
});
