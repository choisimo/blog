import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LiveRoomPanel } from "./LiveRoomPanel";

const mockGetLiveRooms = vi.hoisted(() => vi.fn());

vi.mock("@/services/chat", () => ({
  getLiveRooms: mockGetLiveRooms,
}));

describe("LiveRoomPanel", () => {
  beforeEach(() => {
    mockGetLiveRooms.mockReset();
  });

  it("sanitizes room labels and exposes current room selection semantics", async () => {
    const onRoomSelect = vi.fn();

    mockGetLiveRooms.mockResolvedValueOnce([
      { room: "room:\u001b[31mdev\u001b[0m\u0000", onlineCount: 3 },
    ]);

    const { container } = render(
      <LiveRoomPanel
        isTerminal={false}
        isMobile={false}
        currentRoom="room:dev"
        currentRoomLabel={"\u001b[34mdev\u001b[0m\u0000"}
        onRoomSelect={onRoomSelect}
        onStartDebate={vi.fn()}
      />,
    );

    const roomButton = await screen.findByRole("button", {
      name: "실시간 방 선택: dev, 3명 온라인",
    });

    expect(screen.getByRole("region", { name: "실시간 채팅방" })).toBeInTheDocument();
    expect(roomButton).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "현재 방 AI 토론 시작: dev" })).toHaveAttribute(
      "title",
      "현재 방 AI 토론 (dev)",
    );
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[31m");
    expect(container.textContent).not.toContain("\u0000");

    fireEvent.click(roomButton);

    expect(onRoomSelect).toHaveBeenCalledWith("room:dev");
  });

  it("labels live pin toggle state and hides decorative room icons", async () => {
    const onToggleLivePinned = vi.fn();

    mockGetLiveRooms.mockResolvedValueOnce([
      { room: "room:ops", onlineCount: 1 },
    ]);

    const { container } = render(
      <LiveRoomPanel
        isTerminal
        isMobile
        currentRoom="room:ops"
        livePinned
        onToggleLivePinned={onToggleLivePinned}
        onStartDebate={vi.fn()}
      />,
    );

    const toggle = await screen.findByRole("button", { name: "LIVE 고정 끄기" });

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);

    fireEvent.click(toggle);

    expect(onToggleLivePinned).toHaveBeenCalled();
  });

  it("returns null when only unsafe room ids are available", async () => {
    mockGetLiveRooms.mockResolvedValueOnce([
      { room: "room:\nunsafe", onlineCount: 2 },
    ]);

    const { container } = render(
      <LiveRoomPanel isTerminal={false} isMobile={false} />,
    );

    await waitFor(() => {
      expect(mockGetLiveRooms).toHaveBeenCalled();
    });

    expect(container).toBeEmptyDOMElement();
  });
});
