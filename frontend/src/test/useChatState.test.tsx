import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizeStoredChatMessages,
  useChatState,
} from "@/components/features/chat/widget/hooks/useChatState";
import type { ChatMessage } from "@/components/features/chat/widget/types";

const chatMocks = vi.hoisted(() => ({
  getStoredSessionId: vi.fn(),
  storeSessionId: vi.fn(),
  clearStoredSessionId: vi.fn(),
  generateLocalSessionId: vi.fn(),
  loadSessionsIndex: vi.fn(),
}));

vi.mock("@/services/chat", () => ({
  PERSIST_OPTIN_KEY: "aiChat.persistOptIn",
  getStoredSessionId: chatMocks.getStoredSessionId,
  storeSessionId: chatMocks.storeSessionId,
  clearStoredSessionId: chatMocks.clearStoredSessionId,
  generateLocalSessionId: chatMocks.generateLocalSessionId,
  SESSIONS_INDEX_KEY: "aiChat.sessionsIndex",
  SESSION_MESSAGES_PREFIX: "aiChat.messages.",
  loadSessionsIndex: chatMocks.loadSessionsIndex,
}));

vi.mock("@/services/chat/context", () => ({
  hasArticlePageContext: () => false,
}));

type HookApi = ReturnType<typeof useChatState>;

function Harness({ onReady }: { onReady: (api: HookApi) => void }) {
  const api = useChatState();

  useEffect(() => {
    onReady(api);
  });

  return <output data-testid="session-id">{api.sessionId}</output>;
}

describe("useChatState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    chatMocks.getStoredSessionId.mockReturnValue(null);
    chatMocks.generateLocalSessionId.mockReturnValue(" generated-session ");
    chatMocks.loadSessionsIndex.mockReturnValue([]);
  });

  it("falls back to a generated session id when stored id is polluted", async () => {
    chatMocks.getStoredSessionId.mockReturnValue("session-1\r\nInjected");
    let api: HookApi | null = null;

    render(<Harness onReady={(next) => { api = next; }} />);

    await waitFor(() => expect(api).not.toBeNull());
    expect(screen.getByTestId("session-id").textContent).toBe(
      "generated-session",
    );
    expect(chatMocks.storeSessionId).toHaveBeenCalledWith("generated-session");
  });

  it("trims valid external session ids and ignores polluted session ids", async () => {
    let api: HookApi | null = null;

    render(<Harness onReady={(next) => { api = next; }} />);

    await waitFor(() => expect(api).not.toBeNull());

    act(() => {
      api?.setSessionKey(" session-2 ");
    });
    await waitFor(() => {
      expect(screen.getByTestId("session-id").textContent).toBe("session-2");
    });

    act(() => {
      api?.setSessionKey("session-3\r\nInjected");
    });
    expect(screen.getByTestId("session-id").textContent).toBe("session-2");
  });

  it.each([true, false])(
    "adopts only valid server identities without replacing messages (persistence: %s)",
    (persistOptIn) => {
      const storedMessages: ChatMessage[] = [
        { id: "stored-message", role: "assistant", text: "Old snapshot" },
      ];
      localStorage.setItem(
        "aiChat.messages.server-session",
        JSON.stringify(storedMessages),
      );
      const { result } = renderHook(() => useChatState());
      const activeMessages: ChatMessage[] = [
        { id: "user-message", role: "user", text: "Current question" },
        { id: "pending-reply", role: "assistant", text: "", pending: true },
      ];
      act(() => {
        result.current.setPersistOptIn(persistOptIn);
        result.current.setMessages(activeMessages);
        result.current.setBusy(true);
      });

      act(() => { result.current.adoptSessionKey(" server-session "); });
      expect(result.current.sessionKey).toBe("server-session");
      expect(result.current.messages).toBe(activeMessages);
      expect(result.current.busy).toBe(true);

      act(() => {
        result.current.adoptSessionKey("server-session");
        result.current.adoptSessionKey("bad\r\nid");
        result.current.adoptSessionKey(" ");
      });
      expect(result.current.sessionKey).toBe("server-session");
      expect(result.current.messages).toBe(activeMessages);
    },
  );

  it("restores another history and clears a fresh selection even while busy after adoption", () => {
    const history: ChatMessage[] = [
      { id: "history-reply", role: "assistant", text: "Other conversation" },
    ];
    localStorage.setItem("aiChat.messages.history-session", JSON.stringify(history));
    const { result } = renderHook(() => useChatState());
    act(() => {
      result.current.setMessages([
        { id: "current-user", role: "user", text: "Current question" },
        { id: "current-reply", role: "assistant", text: "", pending: true },
      ]);
      result.current.setBusy(true);
      result.current.adoptSessionKey("server-session");
    });

    act(() => { result.current.setSessionKey("history-session"); });
    expect(result.current.messages).toEqual(history);
    expect(result.current.busy).toBe(true);

    act(() => { result.current.setSessionKey("fresh-session"); });
    expect(result.current.messages).toEqual([]);
    expect(localStorage.getItem("aiChat.messages.history-session")).toBe(
      JSON.stringify(history),
    );
  });

  it("honors an explicit selection batched after adoption of the same identity", () => {
    const history: ChatMessage[] = [
      { id: "history-reply", role: "assistant", text: "Saved answer" },
    ];
    localStorage.setItem("aiChat.messages.server-session", JSON.stringify(history));
    const { result } = renderHook(() => useChatState());
    act(() => {
      result.current.setMessages([
        { id: "pending-reply", role: "assistant", text: "", pending: true },
      ]);
      result.current.adoptSessionKey("server-session");
      result.current.setSessionKey("server-session");
    });

    expect(result.current.sessionKey).toBe("server-session");
    expect(result.current.messages).toEqual(history);
  });

  it.each(["history-session", "fresh-session"])(
    "ignores a delayed identity event from an old stream after selecting %s",
    (selectedKey) => {
      const history: ChatMessage[] = [
        { id: "history-reply", role: "assistant", text: "Other conversation" },
      ];
      localStorage.setItem("aiChat.messages.history-session", JSON.stringify(history));
      const { result } = renderHook(() => useChatState());
      const adoptFromStream = result.current.adoptSessionKey;
      act(() => { adoptFromStream("server-session"); });
      act(() => { adoptFromStream("updated-server-session"); });
      expect(result.current.sessionKey).toBe("updated-server-session");

      act(() => {
        result.current.setSessionKey(selectedKey);
        adoptFromStream("late-server-session");
      });
      expect(result.current.sessionKey).toBe(selectedKey);
      expect(result.current.messages).toEqual(
        selectedKey === "history-session" ? history : [],
      );
    },
  );

  it("normalizes persisted chat messages before restoring them", () => {
    expect(
      normalizeStoredChatMessages([
        { id: " message-1 ", role: "user", text: "hello" },
        { id: "message-2", role: "admin", text: "bad role" },
        { id: "message-3\r\nInjected", role: "assistant", text: "bad id" },
        { id: "message-4", role: "assistant", text: 42 },
        { id: "message-5", role: "assistant", text: "pending", pending: true },
        {
          id: "message-6",
          role: "system",
          text: "event",
          statusSource: "event",
        },
        null,
      ]),
    ).toEqual([{ id: "message-1", role: "user", text: "hello" }]);
  });

  it("fails closed for non-array persisted chat message payloads", () => {
    expect(normalizeStoredChatMessages({ id: "message-1" })).toEqual([]);
    expect(normalizeStoredChatMessages(null)).toEqual([]);
  });
});
