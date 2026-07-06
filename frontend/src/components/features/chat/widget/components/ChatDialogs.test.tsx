import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImageDrawer, MobileActionSheet } from "./ChatDialogs";

describe("ChatDialogs", () => {
  it("sanitizes image drawer labels and disables unsafe image URLs", () => {
    const openWindow = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(
      <ImageDrawer
        open
        onOpenChange={vi.fn()}
        uploadedImages={[
          {
            id: "image-1",
            name: "\u001b[32mDiagram\u001b[0m\u0000",
            url: "/uploads/diagram.png",
            size: 2048,
          },
          {
            id: "image-2",
            name: "Unsafe image",
            url: "javascript:alert(1)",
            size: -1,
          },
        ]}
      />,
    );

    const safeImage = screen.getByRole("button", { name: "이미지 열기: Diagram" });
    const unsafeImage = screen.getByRole("button", { name: "이미지 열기: Unsafe image" });

    expect(safeImage).toHaveAttribute("title", "Diagram");
    expect(unsafeImage).toBeDisabled();
    expect(screen.getByText("2KB")).toBeInTheDocument();
    expect(screen.getByText("크기 알 수 없음")).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[32m");
    expect(container.textContent).not.toContain("\u0000");

    fireEvent.click(safeImage);

    expect(openWindow).toHaveBeenCalledWith(
      "/uploads/diagram.png",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("sanitizes mobile action sheet labels and closes after running actions", () => {
    const onOpenChange = vi.fn();
    const onStartDebate = vi.fn();
    const { container } = render(
      <MobileActionSheet
        open
        onOpenChange={onOpenChange}
        sessions={[{ id: "session-1" } as never]}
        uploadedImages={[{ id: "image-1", name: "Image", url: "/image.png", size: 1 }]}
        persistOptIn={false}
        onShowSessions={vi.fn()}
        onShowImageDrawer={vi.fn()}
        onTogglePersist={vi.fn()}
        onStartDebate={onStartDebate}
        currentLiveRoomLabel="\u001b[31mdev\u001b[0m\u0000"
        onClearAll={vi.fn()}
        isTerminal={false}
      />,
    );

    const debateButton = screen.getByRole("button", {
      name: "현재 방 AI 토론 (dev), LIVE",
    });

    expect(screen.getByRole("button", { name: "최근 대화 보기, 1개" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "이미지 메모 보기, 1개" })).toBeEnabled();
    expect(debateButton).toHaveAttribute("title", "현재 방 AI 토론 (dev), LIVE");
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[31m");
    expect(container.textContent).not.toContain("\u0000");

    fireEvent.click(debateButton);

    expect(onStartDebate).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps unavailable mobile actions disabled", () => {
    render(
      <MobileActionSheet
        open
        onOpenChange={vi.fn()}
        sessions={[]}
        uploadedImages={[]}
        persistOptIn
        onShowSessions={vi.fn()}
        onShowImageDrawer={vi.fn()}
        onTogglePersist={vi.fn()}
        onClearAll={vi.fn()}
        isTerminal
      />,
    );

    expect(screen.getByRole("button", { name: "최근 대화 보기, 0개" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "이미지 메모 보기, 0개" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "현재 방 AI 토론, LIVE" })).toBeDisabled();
  });
});
