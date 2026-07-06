import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { ChatMessages } from "@/components/features/chat/widget/components/ChatMessages";
import type { ChatMessage } from "@/components/features/chat/widget/types";

const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

function renderChatMessages(
  messages: ChatMessage[],
  overrides: Partial<ComponentProps<typeof ChatMessages>> = {},
) {
  return render(
    <ChatMessages
      messages={messages}
      isTerminal={false}
      isMobile
      onPromptClick={vi.fn()}
      onRetry={vi.fn()}
      lastPrompt=""
      {...overrides}
    />,
  );
}

describe("ChatMessages", () => {
  it("normalizes live author metadata and reply callback targets", () => {
    const onReplyToLiveMessage = vi.fn();

    renderChatMessages(
      [
        {
          id: "live-1",
          role: "assistant",
          channel: "live",
          authorName: " Agent\r\nName ",
          authorMeta: " cozy\nbot ",
          liveSenderType: "agent",
          text: "hello",
          pending: false,
        },
      ],
      {
        activeReplyTargetName: "Agent Name",
        onReplyToLiveMessage,
      },
    );

    expect(screen.getByText("Agent Name")).toBeTruthy();
    expect(screen.getByText("cozy bot")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "답장 중" }));
    expect(onReplyToLiveMessage).toHaveBeenCalledWith({
      name: "Agent Name",
      senderType: "agent",
    });
  });

  it("normalizes sources and followup prompt button payloads", () => {
    const onPromptClick = vi.fn();

    renderChatMessages(
      [
        {
          id: "assistant-1",
          role: "assistant",
          text: "answer",
          sources: [
            {
              title: " Safe\nSource ",
              url: "https://example.com/path",
            },
            {
              title: " Bad\r\nSource ",
              url: "javascript:alert(1)",
            },
          ],
          followups: [" Next\r\nQuestion? ", "  "],
        },
      ],
      { onPromptClick },
    );

    const safeSource = screen.getByRole("link", { name: "Safe Source" });
    expect(safeSource.getAttribute("href")).toBe("https://example.com/path");
    expect(screen.getByText("Bad Source").closest("a")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next Question?" }));
    expect(onPromptClick).toHaveBeenCalledWith("Next Question?");
  });
});
