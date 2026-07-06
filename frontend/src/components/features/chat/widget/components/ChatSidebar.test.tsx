import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatSidebar, TypingDots } from "./ChatSidebar";

const mockGetLiveRooms = vi.hoisted(() => vi.fn());

vi.mock("@/services/chat", () => ({
  getLiveRooms: mockGetLiveRooms,
}));

const baseProps = {
  isTerminal: false,
  questionMode: "article" as const,
  onModeChange: vi.fn(),
  currentRoom: undefined,
  onRoomSelect: vi.fn(),
  onStartDebate: vi.fn(),
  currentLiveRoomLabel: undefined,
  sessions: [],
  selectedSessionIds: [],
  onToggleSession: vi.fn(),
  onLoadSession: vi.fn(),
  onAggregateSelected: vi.fn(),
  persistOptIn: false,
  onTogglePersist: vi.fn(),
};

describe("ChatSidebar", () => {
  it("exposes typing dots as a sanitized status indicator", () => {
    const { container } = render(<TypingDots />);

    expect(screen.getByRole("status", { name: "입력 중" })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });

  it("sanitizes live room labels and exposes current room state", async () => {
    mockGetLiveRooms.mockResolvedValueOnce([
      { room: "room:\u001b[31mdev\u001b[0m\u0000", onlineCount: 3 },
    ]);

    const { container } = render(
      <ChatSidebar
        {...baseProps}
        currentRoom="room:dev"
      />,
    );

    const room = await screen.findByRole("button", {
      name: "실시간 방 선택: dev, 3명 온라인",
    });

    expect(room).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("3명 온라인")).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[31m");
    expect(container.textContent).not.toContain("\u0000");
  });

  it("labels sanitized session selection and loading controls", () => {
    mockGetLiveRooms.mockResolvedValueOnce([]);

    render(
      <ChatSidebar
        {...baseProps}
        sessions={[
          {
            id: "session-1",
            title: "\u001b[32m첫 대화\u001b[0m\u0000",
          },
        ] as never}
        selectedSessionIds={["session-1"]}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "대화 선택: 첫 대화" })).toBeChecked();
    expect(screen.getByRole("button", { name: "대화 불러오기: 첫 대화" })).toHaveAttribute(
      "title",
      "첫 대화",
    );
    expect(screen.getByRole("button", { name: "현재 글" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "통합 질문 (1)" })).toBeInTheDocument();
  });
});
