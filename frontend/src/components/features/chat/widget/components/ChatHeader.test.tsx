import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatHeader } from "./ChatHeader";

const baseProps = {
  isMobile: false,
  isTerminal: false,
  busy: false,
  persistOptIn: false,
  sessions: [],
  uploadedImages: [],
  onShowSessions: vi.fn(),
  onShowActionSheet: vi.fn(),
  onShowImageDrawer: vi.fn(),
  onTogglePersist: vi.fn(),
  onClearAll: vi.fn(),
};

describe("ChatHeader", () => {
  it("sanitizes transport labels and exposes them as polite status updates", () => {
    const { container } = render(
      <ChatHeader
        {...baseProps}
        transportStatus={{
          phase: "connected",
          label: "\u001b[32m연결됨\u001b[0m\u0000",
          detail: "connected",
          tone: "info",
          roomLabel: "main",
          updatedAt: 1,
        }}
      />,
    );

    const transport = screen.getByRole("status", { name: "연결됨" });

    expect(transport).toHaveAttribute("aria-live", "polite");
    expect(transport).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByText("연결됨")).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[32m");
    expect(container.textContent).not.toContain("\u0000");
  });

  it("exposes error transport labels as assertive alerts", () => {
    render(
      <ChatHeader
        {...baseProps}
        transportStatus={{
          phase: "disconnected",
          label: "연결 끊김",
          detail: "offline",
          tone: "error",
          roomLabel: "main",
          updatedAt: 1,
        }}
      />,
    );

    const alert = screen.getByRole("alert", { name: "연결 끊김" });

    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("hides decorative icons and terminal window controls from assistive technology", () => {
    const { container } = render(
      <ChatHeader
        {...baseProps}
        isTerminal
        canExpand
        sidebarOpen
        onToggleSidebar={vi.fn()}
        onToggleExpanded={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "사이드바 닫기" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "채팅 창 확대" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "창 닫기" })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(4);
  });

  it("announces busy status metadata", () => {
    render(<ChatHeader {...baseProps} busy />);

    expect(screen.getByLabelText("생성 중…")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("생성 중…")).toBeInTheDocument();
  });
});
