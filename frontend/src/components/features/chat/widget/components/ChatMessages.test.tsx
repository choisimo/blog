import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatMessages } from "./ChatMessages";

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../ChatMarkdown", () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="chat-markdown">{content}</div>
  ),
}));

const baseProps = {
  isTerminal: false,
  isMobile: false,
  onPromptClick: vi.fn(),
  onRetry: vi.fn(),
  lastPrompt: "",
};

describe("ChatMessages", () => {
  it("sanitizes assistant message content, sources, and followup actions", () => {
    const onPromptClick = vi.fn();
    const { container } = render(
      <ChatMessages
        {...baseProps}
        onPromptClick={onPromptClick}
        messages={[
          {
            id: "assistant-1",
            role: "assistant",
            text: "\u001b[31mAnswer\u001b[0m\u0000",
            sources: [
              {
                title: "\u001b[32mDocs\u001b[0m\u0000",
                url: "https://example.com/docs",
              },
              {
                title: "Unsafe",
                url: "https://user:pass@example.com/docs",
              },
            ],
            followups: ["\u001b[33mNext question\u001b[0m\u0007"],
          },
        ] as never}
      />,
    );

    expect(screen.getByTestId("chat-markdown")).toHaveTextContent("Answer");
    expect(screen.getByRole("link", { name: "출처 열기: Docs" })).toHaveAttribute(
      "href",
      "https://example.com/docs",
    );
    expect(screen.getByText("Unsafe")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "출처 열기: Unsafe" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "연관 질문 선택: Next question" }));

    expect(onPromptClick).toHaveBeenCalledWith("Next question");
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[31m");
    expect(container.textContent).not.toContain("\u0000");
  });

  it("labels live reply actions and passes sanitized reply targets", () => {
    const onReplyToLiveMessage = vi.fn();
    render(
      <ChatMessages
        {...baseProps}
        activeReplyTargetName="Agent"
        onReplyToLiveMessage={onReplyToLiveMessage}
        messages={[
          {
            id: "live-1",
            role: "assistant",
            channel: "live",
            authorName: "\u001b[32mAgent\u001b[0m\u0000",
            authorMeta: "operator",
            liveSenderType: "agent",
            text: "Live answer",
          },
        ] as never}
      />,
    );

    const replyButton = screen.getByRole("button", { name: "답장 중: Agent" });

    expect(replyButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(replyButton);

    expect(onReplyToLiveMessage).toHaveBeenCalledWith({
      name: "Agent",
      senderType: "agent",
    });
  });

  it("renders terminal system errors as alerts with sanitized retry action", () => {
    const onRetry = vi.fn();
    const { container } = render(
      <ChatMessages
        {...baseProps}
        isTerminal
        lastPrompt="retry prompt"
        onRetry={onRetry}
        messages={[
          {
            id: "system-1",
            role: "system",
            systemLevel: "error",
            text: "\u001b[31m실패\u001b[0m\u0000",
          },
        ] as never}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("[ERROR]");
    expect(screen.getByRole("alert")).toHaveTextContent("실패");

    fireEvent.click(screen.getByRole("button", { name: "마지막 질문 다시 시도하기" }));

    expect(onRetry).toHaveBeenCalledWith("retry prompt");
    expect(container.textContent).not.toContain("\u001b");
  });

  it("sanitizes terminal user message text before rendering", () => {
    const { container } = render(
      <ChatMessages
        {...baseProps}
        isTerminal
        messages={[
          {
            id: "user-1",
            role: "user",
            text: "\u001b[31mHello\u001b[0m\u0000",
          },
        ] as never}
      />,
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[31m");
    expect(container.textContent).not.toContain("\u0000");
  });
});
