import { createRef, type ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatInput } from "@/components/features/chat/widget/components/ChatInput";
import type { LiveReplyTarget } from "@/components/features/chat/widget/types";
import type { SelectedBlockAttachment } from "@/services/chat";

function renderChatInput(
  overrides: Partial<ComponentProps<typeof ChatInput>> = {},
) {
  const textareaRef = createRef<HTMLTextAreaElement>();
  const fileInputRef = createRef<HTMLInputElement>();

  return render(
    <ChatInput
      input=""
      onInputChange={vi.fn()}
      onKeyDown={vi.fn()}
      onSend={vi.fn()}
      onStop={vi.fn()}
      onClearAll={vi.fn()}
      onFileSelect={vi.fn()}
      selectedBlockAttachments={[]}
      onRemoveSelectedBlockAttachment={vi.fn()}
      attachedImage={null}
      attachedPreviewUrl={null}
      busy={false}
      canSend
      firstTokenMs={null}
      questionMode="general"
      liveReplyTarget={null}
      onClearLiveReplyTarget={vi.fn()}
      isTerminal={false}
      isMobile={false}
      textareaRef={textareaRef}
      fileInputRef={fileInputRef}
      hasMessages
      {...overrides}
    />,
  );
}

describe("ChatInput", () => {
  it("normalizes live reply target labels in placeholder and banner text", () => {
    renderChatInput({
      liveReplyTarget: {
        name: " Agent\r\nName ",
        senderType: "agent",
      } as LiveReplyTarget,
    });

    expect(
      screen.getByPlaceholderText("Agent Name에게 라이브로 답장하기..."),
    ).toBeTruthy();
    expect(screen.getByText("Agent Name")).toBeTruthy();
    expect(screen.queryByText(/Agent\r?\nName/)).toBeNull();
  });

  it("normalizes attachment and image display labels", () => {
    const selectedBlockAttachment = {
      id: "block-1",
      name: " Block\r\nName ",
      contentType: "text/markdown",
      textPreview: "preview",
      markdown: "markdown",
      sizeBytes: 512,
      source: "selection",
      truncated: false,
    } as SelectedBlockAttachment;
    const image = new File(["image"], " photo\u0000\nname.png ", {
      type: "image/png",
    });

    renderChatInput({
      selectedBlockAttachments: [selectedBlockAttachment],
      attachedImage: image,
      attachedPreviewUrl: "blob:preview",
    });

    expect(screen.getByText("Block Name")).toBeTruthy();
    expect(screen.getByText("photo name.png")).toBeTruthy();
    expect(screen.getByAltText("photo name.png")).toBeTruthy();
  });

  it("sanitizes selected block preview text before rendering expanded attachment content", () => {
    const selectedBlockAttachment = {
      id: "block-1",
      name: "Block",
      contentType: "text/markdown",
      textPreview: "preview\u0000\r\nline\u007F",
      markdown: "markdown",
      sizeBytes: 512,
      source: "selection",
      truncated: false,
    } as SelectedBlockAttachment;

    renderChatInput({
      selectedBlockAttachments: [selectedBlockAttachment],
    });

    fireEvent.click(
      screen.getByRole("button", { name: "첨부 미리보기 펼치기" }),
    );

    expect(screen.getByText(/preview\s+line/)).toBeTruthy();
    expect(screen.queryByText(/preview\u0000/)).toBeNull();
  });
});
