import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatSessionPanel } from "@/components/features/chat/widget/components/ChatSessionPanel";

function session(overrides: Partial<Parameters<typeof ChatSessionPanel>[0]["sessions"][number]> = {}) {
  return {
    id: "session-1",
    title: "Valid session",
    summary: "Summary",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    messageCount: 1,
    mode: "general" as const,
    ...overrides,
  };
}

function renderPanel(
  props: Partial<Parameters<typeof ChatSessionPanel>[0]> = {},
) {
  const defaults: Parameters<typeof ChatSessionPanel>[0] = {
    sessions: [session()],
    selectedSessionIds: [],
    onToggleSession: vi.fn(),
    onLoadSession: vi.fn(),
    onClose: vi.fn(),
    onAggregateSelected: vi.fn(),
    isTerminal: false,
    isMobile: false,
  };

  return {
    ...render(<ChatSessionPanel {...defaults} {...props} />),
    props: { ...defaults, ...props },
  };
}

describe("ChatSessionPanel", () => {
  it("normalizes session ids before toggling and loading sessions", () => {
    const onToggleSession = vi.fn();
    const onLoadSession = vi.fn();
    const onClose = vi.fn();

    renderPanel({
      sessions: [session({ id: " session-1 " })],
      onToggleSession,
      onLoadSession,
      onClose,
    });

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggleSession).toHaveBeenCalledWith("session-1");

    fireEvent.click(screen.getByRole("button", { name: /Valid session/ }));
    expect(onLoadSession).toHaveBeenCalledWith("session-1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render sessions with polluted ids", () => {
    const { container } = renderPanel({
      sessions: [
        session({
          id: "session-1\r\nX-Injected: yes",
          title: "Polluted session",
        }),
      ],
    });

    expect(container.firstChild).toBeNull();
  });

  it("normalizes stored session title labels before rendering", () => {
    renderPanel({
      sessions: [
        session({
          title: " First\r\nSession ",
          articleTitle: " Article\nTitle ",
        }),
      ],
    });

    expect(screen.getByText("First Session")).toBeInTheDocument();
    expect(screen.getByText("Article Title")).toBeInTheDocument();
    expect(screen.queryByText(/First\r?\nSession/)).toBeNull();
  });

  it("counts only valid selected session ids and disables aggregate for invalid selection", () => {
    const onAggregateSelected = vi.fn();

    renderPanel({
      selectedSessionIds: ["session-1\r\nX-Injected: yes"],
      onAggregateSelected,
    });

    expect(screen.getByText("선택: 0개")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "통합 질문하기" }),
    ).toBeDisabled();
  });

  it("keeps aggregate enabled for trimmed valid selected session ids", () => {
    const onAggregateSelected = vi.fn();

    renderPanel({
      selectedSessionIds: [" session-1 "],
      onAggregateSelected,
    });

    expect(screen.getByText("선택: 1개")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "통합 질문하기" }));
    expect(onAggregateSelected).toHaveBeenCalledTimes(1);
  });
});
