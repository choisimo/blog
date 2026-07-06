import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizeStoredChatMessages,
  useChatState,
} from "@/components/features/chat/widget/hooks/useChatState";

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
