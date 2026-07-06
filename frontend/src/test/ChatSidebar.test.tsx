import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatSidebar } from "@/components/features/chat/widget/components/ChatSidebar";

const chatMocks = vi.hoisted(() => ({
  getLiveRooms: vi.fn(),
}));

vi.mock("@/services/chat", () => ({
  getLiveRooms: chatMocks.getLiveRooms,
}));

function renderSidebar(
  overrides: Partial<ComponentProps<typeof ChatSidebar>> = {},
) {
  return render(
    <ChatSidebar
      isTerminal={false}
      questionMode="general"
      onModeChange={vi.fn()}
      currentRoom="room:lobby"
      onRoomSelect={vi.fn()}
      onStartDebate={vi.fn()}
      currentLiveRoomLabel="room:lobby"
      sessions={[]}
      selectedSessionIds={[]}
      onToggleSession={vi.fn()}
      onLoadSession={vi.fn()}
      onAggregateSelected={vi.fn()}
      persistOptIn={false}
      onTogglePersist={vi.fn()}
      livePinned={false}
      onToggleLivePinned={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ChatSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatMocks.getLiveRooms.mockResolvedValue([]);
  });

  it("normalizes live room labels and selection callbacks", async () => {
    const onRoomSelect = vi.fn();
    chatMocks.getLiveRooms.mockResolvedValueOnce([
      {
        room: " room:blog:2026:safe ",
        onlineCount: 2,
        messageCount: 1,
        lastActivity: null,
        lastText: null,
      },
      {
        room: "room:bad\r\nInjected",
        onlineCount: 1,
        messageCount: 1,
        lastActivity: null,
        lastText: null,
      },
    ]);

    renderSidebar({ onRoomSelect });

    await waitFor(() => expect(screen.getByText("blog/2026/safe")).toBeTruthy());
    expect(screen.queryByText(/bad/)).toBeNull();

    fireEvent.click(screen.getByText("blog/2026/safe"));
    expect(onRoomSelect).toHaveBeenCalledWith("room:blog:2026:safe");
  });

  it("normalizes stored session labels and valid selected-session counts", () => {
    const onToggleSession = vi.fn();
    const onLoadSession = vi.fn();

    renderSidebar({
      sessions: [
        {
          id: " session-1 ",
          title: " First\r\nSession ",
          summary: "",
          createdAt: "",
          updatedAt: "",
          messageCount: 1,
          mode: "general",
        },
        {
          id: "session-2\r\nInjected",
          title: "Bad session",
          summary: "",
          createdAt: "",
          updatedAt: "",
          messageCount: 1,
          mode: "general",
        },
      ],
      selectedSessionIds: [" session-1 ", "session-2\r\nInjected"],
      onToggleSession,
      onLoadSession,
    });

    expect(screen.getByText("First Session")).toBeTruthy();
    expect(screen.queryByText("Bad session")).toBeNull();
    expect(screen.getByRole("button", { name: "통합 질문 (1)" })).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggleSession).toHaveBeenCalledWith("session-1");

    fireEvent.click(screen.getByRole("button", { name: "First Session" }));
    expect(onLoadSession).toHaveBeenCalledWith("session-1");
  });
});
