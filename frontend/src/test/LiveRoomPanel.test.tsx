import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LiveRoomPanel } from "@/components/features/chat/widget/components/LiveRoomPanel";

const chatMocks = vi.hoisted(() => ({
  getLiveRooms: vi.fn(),
}));

vi.mock("@/services/chat", () => ({
  getLiveRooms: chatMocks.getLiveRooms,
}));

function renderLiveRoomPanel(
  overrides: Partial<ComponentProps<typeof LiveRoomPanel>> = {},
) {
  return render(
    <LiveRoomPanel
      isTerminal={false}
      isMobile={false}
      currentRoom="room:lobby"
      onRoomSelect={vi.fn()}
      onStartDebate={vi.fn()}
      currentRoomLabel="room:lobby"
      livePinned={false}
      onToggleLivePinned={vi.fn()}
      {...overrides}
    />,
  );
}

describe("LiveRoomPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatMocks.getLiveRooms.mockResolvedValue([]);
  });

  it("normalizes live room ids before rendering labels and selecting rooms", async () => {
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
        onlineCount: 5,
        messageCount: 1,
        lastActivity: null,
        lastText: null,
      },
    ]);

    renderLiveRoomPanel({ onRoomSelect });

    await waitFor(() => expect(screen.getByText("blog/2026/safe")).toBeTruthy());
    expect(screen.queryByText(/bad/)).toBeNull();

    fireEvent.click(screen.getByText("blog/2026/safe"));
    expect(onRoomSelect).toHaveBeenCalledWith("room:blog:2026:safe");
  });

  it("normalizes current room labels in debate button titles", async () => {
    chatMocks.getLiveRooms.mockResolvedValueOnce([
      {
        room: "room:lobby",
        onlineCount: 1,
        messageCount: 1,
        lastActivity: null,
        lastText: null,
      },
    ]);

    renderLiveRoomPanel({
      currentRoomLabel: " room:lobby\r\nInjected ",
    });

    const debateButton = await screen.findByRole("button", {
      name: "AI 토론",
    });
    expect(debateButton.getAttribute("title")).toBe(
      "현재 방 AI 토론 (room:lobby Injected)",
    );
  });
});
