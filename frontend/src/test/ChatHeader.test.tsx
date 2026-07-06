import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { ChatHeader } from "@/components/features/chat/widget/components/ChatHeader";
import type { ChatTransportStatus } from "@/components/features/chat/widget/types";

function renderChatHeader(
  overrides: Partial<ComponentProps<typeof ChatHeader>> = {},
) {
  return render(
    <ChatHeader
      isMobile={false}
      isTerminal={false}
      busy={false}
      persistOptIn={false}
      sessions={[]}
      uploadedImages={[]}
      onShowSessions={vi.fn()}
      onShowActionSheet={vi.fn()}
      onShowImageDrawer={vi.fn()}
      onTogglePersist={vi.fn()}
      onClearAll={vi.fn()}
      sidebarOpen={false}
      onToggleSidebar={vi.fn()}
      canExpand={false}
      expanded={false}
      onToggleExpanded={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ChatHeader", () => {
  it("normalizes pinned live room labels in header status text", () => {
    renderChatHeader({
      livePinned: true,
      currentLiveRoomLabel: " room:lobby\r\nInjected ",
    });

    expect(screen.getByText("LIVE 고정 ON (room:lobby Injected)")).toBeTruthy();
    expect(screen.queryByText(/room:lobby\r?\nInjected/)).toBeNull();
  });

  it("normalizes transport status labels before rendering pills", () => {
    const transportStatus = {
      phase: "connected",
      tone: "info",
      roomLabel: "room:lobby",
      onlineCount: 1,
      reconnectAttempts: 0,
      updatedAt: 1,
      label: " connected\r\nnow ",
      detail: "connected",
    } as ChatTransportStatus;

    renderChatHeader({ transportStatus });

    expect(screen.getByText("connected now")).toBeTruthy();
    expect(screen.queryByText(/connected\r?\nnow/)).toBeNull();
  });
});
