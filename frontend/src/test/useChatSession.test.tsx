import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ChatMessage,
  ChatSessionMeta,
} from "@/components/features/chat/widget/types";

const {
  mockLoadSessionMessages,
  mockStoreSessionsIndex,
  mockSwitchToSession,
} = vi.hoisted(() => ({
  mockLoadSessionMessages: vi.fn(),
  mockStoreSessionsIndex: vi.fn(),
  mockSwitchToSession: vi.fn(),
}));

vi.mock("@/services/chat", () => ({
  loadSessionMessages: mockLoadSessionMessages,
  storeSessionsIndex: mockStoreSessionsIndex,
  switchToSession: mockSwitchToSession,
}));

import { useChatSession } from "@/components/features/chat/widget/hooks/useChatSession";

type HookApi = ReturnType<typeof useChatSession>;
type HookHandle = {
  api: HookApi;
  getSessionKey: () => string;
};

function noop() {
  return undefined;
}

function Harness({
  initialMessages = [],
  initialSessionKey = "session-1",
  initialSessions = [],
  onReady,
  persistOptIn = false,
}: {
  initialMessages?: ChatMessage[];
  initialSessionKey?: string;
  initialSessions?: ChatSessionMeta[];
  onReady: (handle: HookHandle) => void;
  persistOptIn?: boolean;
}) {
  const [sessionKey, setSessionKey] = useState(initialSessionKey);
  const [sessions, setSessions] = useState<ChatSessionMeta[]>(initialSessions);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [input, setInput] = useState("");

  const api = useChatSession({
    sessionKey,
    setSessionKey,
    sessions,
    setSessions,
    messages,
    setMessages,
    persistOptIn,
    questionMode: "general",
    summary: "Session summary",
    pageTitle: "Page title",
    setFirstTokenMs: noop,
    setAttachedImage: noop,
    setIsAggregatePrompt: noop,
    setShowSessions: noop,
    selectedSessionIds,
    setSelectedSessionIds,
    setInput,
  });

  useEffect(() => {
    onReady({
      api,
      getSessionKey: () => sessionKey,
    });
  });

  return <output data-testid="aggregate-input">{input}</output>;
}

describe("useChatSession", () => {
  afterEach(() => {
    vi.useRealTimers();
    mockLoadSessionMessages.mockReset();
    mockStoreSessionsIndex.mockReset();
    mockSwitchToSession.mockReset();
  });

  it("normalizes session ids before loading and switching sessions", async () => {
    let handle: HookHandle | null = null;
    mockLoadSessionMessages.mockReturnValue([
      { role: "assistant", text: "loaded" },
    ]);

    render(<Harness onReady={(next) => { handle = next; }} />);

    await waitFor(() => expect(handle).not.toBeNull());
    act(() => {
      handle?.api.loadSession(" session-1 ");
    });

    expect(mockLoadSessionMessages).toHaveBeenCalledWith("session-1");
    expect(mockSwitchToSession).toHaveBeenCalledWith("session-1");
    await waitFor(() => {
      expect(handle?.getSessionKey()).toBe("session-1");
    });
  });

  it("rejects polluted session ids before loading sessions", async () => {
    let handle: HookHandle | null = null;

    render(<Harness onReady={(next) => { handle = next; }} />);

    await waitFor(() => expect(handle).not.toBeNull());
    act(() => {
      handle?.api.loadSession("session-1\r\nX-Injected: yes");
    });

    expect(mockLoadSessionMessages).not.toHaveBeenCalled();
    expect(mockSwitchToSession).not.toHaveBeenCalled();
  });

  it("filters polluted session ids from aggregate prompts", async () => {
    let handle: HookHandle | null = null;

    render(
      <Harness
        initialSessions={[
          {
            id: "session-1",
            title: "First session",
            summary: "Useful summary",
            createdAt: "",
            updatedAt: "",
            messageCount: 1,
            mode: "general",
          },
          {
            id: "bad-session\r\nX-Injected: yes",
            title: "Bad session",
            summary: "Bad summary",
            createdAt: "",
            updatedAt: "",
            messageCount: 1,
            mode: "general",
          },
        ]}
        onReady={(next) => { handle = next; }}
      />,
    );

    await waitFor(() => expect(handle).not.toBeNull());
    act(() => {
      handle?.api.aggregateFromSessionIds([
        " session-1 ",
        "bad-session\r\nX-Injected: yes",
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("aggregate-input").textContent).toContain(
        "First session",
      );
    });
    expect(screen.getByTestId("aggregate-input").textContent).toContain(
      "Useful summary",
    );
    expect(screen.getByTestId("aggregate-input").textContent).not.toContain(
      "Bad session",
    );
  });

  it("normalizes aggregate prompt session metadata lines", async () => {
    let handle: HookHandle | null = null;

    render(
      <Harness
        initialSessions={[
          {
            id: "session-1",
            title: "First\nsession",
            summary: "Useful\r\nsummary",
            createdAt: "",
            updatedAt: "",
            messageCount: 1,
            mode: "general",
          },
        ]}
        onReady={(next) => { handle = next; }}
      />,
    );

    await waitFor(() => expect(handle).not.toBeNull());
    act(() => {
      handle?.api.aggregateFromSessionIds(["session-1"]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("aggregate-input").textContent).toContain(
        "1) First session",
      );
    });
    expect(screen.getByTestId("aggregate-input").textContent).toContain(
      "Useful summary",
    );
    expect(screen.getByTestId("aggregate-input").textContent).not.toContain(
      "First\nsession",
    );
  });

  it("does not persist metadata for polluted active session keys", async () => {
    vi.useFakeTimers();
    let handle: HookHandle | null = null;

    render(
      <Harness
        initialMessages={[{ role: "user", text: "hello" }]}
        initialSessionKey={"session-1\r\nX-Injected: yes"}
        onReady={(next) => { handle = next; }}
        persistOptIn
      />,
    );

    await waitFor(() => expect(handle).not.toBeNull());
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockStoreSessionsIndex).not.toHaveBeenCalled();
  });
});
