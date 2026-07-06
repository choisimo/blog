import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ImageDrawer,
  MobileActionSheet,
} from "@/components/features/chat/widget/components/ChatDialogs";

describe("ChatDialogs", () => {
  it("normalizes image drawer labels and blocks unsafe image URLs", () => {
    const openMock = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    render(
      <ImageDrawer
        open
        onOpenChange={vi.fn()}
        uploadedImages={[
          {
            id: "img-1",
            url: "javascript:alert(1)",
            name: " Bad\r\nImage ",
            size: 1024,
          },
          {
            id: "img-2",
            url: " https://example.com/image.png ",
            name: " Safe\nImage ",
            size: 2048,
          },
        ]}
      />,
    );

    expect(screen.getByText("Bad Image")).toBeTruthy();
    expect(screen.queryByAltText("Bad Image")).toBeNull();
    expect(screen.getByAltText("Safe Image").getAttribute("src")).toBe(
      "https://example.com/image.png",
    );

    fireEvent.click(screen.getByText("Bad Image"));
    expect(openMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Safe Image"));
    expect(openMock).toHaveBeenCalledWith(
      "https://example.com/image.png",
      "_blank",
      "noopener,noreferrer",
    );

    openMock.mockRestore();
  });

  it("normalizes mobile action sheet live room labels", () => {
    render(
      <MobileActionSheet
        open
        onOpenChange={vi.fn()}
        sessions={[]}
        uploadedImages={[]}
        persistOptIn={false}
        onShowSessions={vi.fn()}
        onShowImageDrawer={vi.fn()}
        onTogglePersist={vi.fn()}
        onStartDebate={vi.fn()}
        currentLiveRoomLabel=" room:lobby\r\nInjected "
        onClearAll={vi.fn()}
        isTerminal={false}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /현재 방 AI 토론 \(room:lobby Injected\)/,
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/room:lobby\r?\nInjected/)).toBeNull();
  });
});
