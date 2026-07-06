import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@/components/features/chat/widget/types";
import { useLiveVisitorChat } from "@/components/features/chat/widget/hooks/useLiveVisitorChat";

const mocks = vi.hoisted(() => ({
  connectLiveChatStream: vi.fn(),
  sendLiveChatMessage: vi.fn(),
}));

vi.mock("@/services/chat", () => ({
  connectLiveChatStream: mocks.connectLiveChatStream,
  sendLiveChatMessage: mocks.sendLiveChatMessage,
}));

type HookApi = ReturnType<typeof useLiveVisitorChat>;
type HookHandle = {
  api: HookApi;
};

type StreamOptions = {
  onEvent: (event: Record<string, unknown>) => void;
};

function Harness({ onReady }: { onReady: (handle: HookHandle) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const api = useLiveVisitorChat({
    sessionId: "session-1",
    setMessages,
  });

  useEffect(() => {
    onReady({ api });
  });

  return <output data-testid="messages">{JSON.stringify(messages)}</output>;
}

describe("useLiveVisitorChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem("aiChat.liveVisitorName", " Visitor\r\nSelf ");
    mocks.connectLiveChatStream.mockReturnValue(vi.fn());
    mocks.sendLiveChatMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("normalizes live stream message payloads before committing them", async () => {
    let handle: HookHandle | null = null;

    render(<Harness onReady={(next) => { handle = next; }} />);

    await waitFor(() => expect(handle).not.toBeNull());
    await waitFor(() => expect(mocks.connectLiveChatStream).toHaveBeenCalled());
    const options = mocks.connectLiveChatStream.mock.calls[0][0] as StreamOptions;

    act(() => {
      options.onEvent({
        type: "live_message",
        room: "room:lobby",
        sessionId: "other-session",
        senderType: "agent",
        name: " Agent\nName ",
        text: " hello\u0000\nworld ",
        personaStyle: " cozy\nbot ",
        contextKinds: [" rag\ncontext ", 123],
        replyToName: " Visitor\r\nName ",
        sources: [
          {
            title: " Source\nOne ",
            url: " https://example.com/source ",
            snippet: " Snippet\r\nOne ",
            score: 0.75,
          },
          {
            title: "Unsafe",
            url: "javascript:alert(1)",
          },
          null,
        ],
      });
    });

    expect(handle).not.toBeNull();
    const messages = JSON.parse(
      screen.getByTestId("messages").textContent || "[]",
    ) as ChatMessage[];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      authorName: "Agent Name",
      authorMeta: "cozy bot persona · rag context backed · replying to Visitor Name",
      text: "hello\nworld",
      sources: [
        {
          title: "Source One",
          url: "https://example.com/source",
          snippet: "Snippet One",
          score: 0.75,
        },
        {
          title: "Unsafe",
        },
      ],
    });
  });

  it("normalizes stored visitor names and outbound visitor message fields", async () => {
    let handle: HookHandle | null = null;

    render(<Harness onReady={(next) => { handle = next; }} />);

    await waitFor(() => expect(handle).not.toBeNull());
    await waitFor(() => expect(mocks.connectLiveChatStream).toHaveBeenCalled());
    expect(mocks.connectLiveChatStream.mock.calls[0][0]).toMatchObject({
      name: "Visitor Self",
    });

    await act(async () => {
      await handle?.api.sendVisitorMessage({
        text: " hello\u0000 ",
        replyToName: " Agent\r\nName ",
        mentionedAgents: [" Mentor\nBot ", "  "],
      });
    });

    expect(mocks.sendLiveChatMessage).toHaveBeenCalledWith({
      sessionId: "session-1",
      text: "hello",
      room: "room:lobby",
      name: "Visitor Self",
      senderType: "client",
      replyToName: "Agent Name",
      mentionedAgents: ["Mentor Bot"],
    });
  });
});
