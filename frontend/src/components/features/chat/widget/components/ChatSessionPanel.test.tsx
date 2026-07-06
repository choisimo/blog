import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatSessionPanel, ModeSelector } from "./ChatSessionPanel";

const basePanelProps = {
  selectedSessionIds: [],
  onToggleSession: vi.fn(),
  onLoadSession: vi.fn(),
  onClose: vi.fn(),
  onAggregateSelected: vi.fn(),
  isTerminal: false,
  isMobile: false,
};

describe("ChatSessionPanel", () => {
  it("sanitizes session titles and exposes labeled selection and load controls", () => {
    const onToggleSession = vi.fn();
    const onLoadSession = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <ChatSessionPanel
        {...basePanelProps}
        selectedSessionIds={["session-1"]}
        onToggleSession={onToggleSession}
        onLoadSession={onLoadSession}
        onClose={onClose}
        sessions={[
          {
            id: "session-1",
            title: "\u001b[32m첫 대화\u001b[0m\u0000",
            articleTitle: "\u001b[33m본문 제목\u001b[0m\u0007",
            updatedAt: "2026-07-05T00:00:00.000Z",
          },
        ] as never}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "대화 선택: 첫 대화" });
    const loadButton = screen.getByRole("button", { name: "대화 불러오기: 첫 대화" });

    expect(screen.getByRole("region", { name: "최근 대화 세션" })).toBeInTheDocument();
    expect(checkbox).toBeChecked();
    expect(loadButton).toHaveAttribute("title", "첫 대화");
    expect(screen.getByText("본문 제목")).toBeInTheDocument();
    expect(screen.getByLabelText("선택한 대화 1개 통합 질문하기")).toBeEnabled();
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[32m");
    expect(container.textContent).not.toContain("\u0000");

    fireEvent.click(checkbox);
    fireEvent.click(loadButton);

    expect(onToggleSession).toHaveBeenCalledWith("session-1");
    expect(onLoadSession).toHaveBeenCalledWith("session-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("filters sessions with unsafe ids and returns null when none remain", () => {
    const { container } = render(
      <ChatSessionPanel
        {...basePanelProps}
        sessions={[
          {
            id: "session-\u001b[31m1",
            title: "Unsafe",
            updatedAt: "2026-07-05T00:00:00.000Z",
          },
        ] as never}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders invalid session dates with a safe fallback", () => {
    render(
      <ChatSessionPanel
        {...basePanelProps}
        sessions={[
          {
            id: "session-invalid-date",
            title: "날짜 없는 대화",
            updatedAt: "not-a-date",
          },
        ] as never}
      />,
    );

    expect(screen.getByText("날짜 없음")).toBeInTheDocument();
  });

  it("labels mode selector buttons and exposes pressed state", () => {
    render(
      <ModeSelector
        questionMode="general"
        onModeChange={vi.fn()}
        isTerminal={false}
        isMobile={false}
      />,
    );

    expect(screen.getByRole("button", { name: "모드 선택: 이 글 관련" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "모드 선택: 자유 대화" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
