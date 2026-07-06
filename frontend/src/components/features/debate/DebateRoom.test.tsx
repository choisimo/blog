import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DebateRoom, { type DebateTopic } from "./DebateRoom";

const chatMocks = vi.hoisted(() => ({
  streamChatEvents: vi.fn(),
  invokeChatTask: vi.fn(),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock("@/components/molecules/ChatMarkdown", () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock("@/services/chat", () => chatMocks);

function makeTopic(overrides: Partial<DebateTopic> = {}): DebateTopic {
  return {
    title: "Safe topic",
    context: "Safe context",
    entryMode: "default",
    ...overrides,
  };
}

function renderRoom(topic: DebateTopic) {
  render(<DebateRoom topic={topic} onClose={vi.fn()} />);
}

describe("DebateRoom", () => {
  beforeEach(() => {
    chatMocks.streamChatEvents.mockImplementation(async function* () {
      yield { type: "text", text: "\u001b[31mAssistant answer\u001b[0m\u0007" };
      yield {
        type: "followups",
        questions: ["\u001b[32mFollow up?\u001b[0m\u0000"],
      };
    });
    chatMocks.invokeChatTask.mockResolvedValue({ data: { questions: [] } });
  });

  it("sanitizes topic metadata before rendering the intro", () => {
    renderRoom(
      makeTopic({
        title: "\u001b[31mUnsafe topic\u001b[0m\u0000",
        context: "Context\u001b[33m line\u001b[0m\u0007",
        entryMode: "prism",
        facets: [
          {
            title: "Facet\u0000",
            points: ["Point\u001b[31m one\u001b[0m"],
          },
        ],
      }),
    );

    expect(screen.getAllByText("Unsafe topic").length).toBeGreaterThan(0);
    expect(screen.getByText("Context line")).toBeInTheDocument();
    expect(screen.getByText(/1개의 관점/)).toBeInTheDocument();
  });

  it("sanitizes prompt inputs, streamed responses, and streamed follow-ups", async () => {
    renderRoom(
      makeTopic({
        title: "\u001b[31mUnsafe topic\u001b[0m\u0000",
        context: "Context\u001b[33m line\u001b[0m\u0007",
        entryMode: "chain",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /이 질문부터 이어갈래요/i }),
    );

    await waitFor(() => {
      expect(chatMocks.streamChatEvents).toHaveBeenCalled();
    });

    const prompt = chatMocks.streamChatEvents.mock.calls[0]?.[0]?.text;
    expect(prompt).toContain("Unsafe topic");
    expect(prompt).toContain("Context line");
    expect(prompt).not.toContain("\u001b");
    expect(prompt).not.toContain("\u0000");

    expect(await screen.findByText("Assistant answer")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Follow up\?/i }),
    ).toBeInTheDocument();
  });
});
