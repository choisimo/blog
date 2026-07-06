import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileShellBar, ShellOutputOverlay } from "./ShellComponents";

describe("ShellComponents", () => {
  it("sanitizes shell overlay output and exposes specific overlay actions", () => {
    const onExpand = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <ShellOutputOverlay
        output={"\u001b[31mBuild complete\u001b[0m\u0000"}
        onExpand={onExpand}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("region", { name: "터미널 출력" })).toBeInTheDocument();
    expect(screen.getByText("Build complete")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("\u001b");
    expect(document.body.textContent).not.toContain("[31m");
    expect(document.body.textContent).not.toContain("\u0000");
    expect(document.body.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByRole("button", { name: "터미널 출력 확장" }));
    fireEvent.click(screen.getByRole("button", { name: "터미널 출력 닫기" }));

    expect(onExpand).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render shell overlay when sanitized output is empty", () => {
    const { container } = render(
      <ShellOutputOverlay
        output={"\u001b[32m\u0000"}
        onExpand={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("region", { name: "터미널 출력" })).not.toBeInTheDocument();
  });

  it("sanitizes mobile shell path and supports keyboard activation", () => {
    const onShellOpen = vi.fn();
    const { container } = render(
      <MobileShellBar
        displayPath={"\u001b[33m~/posts\u001b[0m\u0007"}
        onShellOpen={onShellOpen}
        showScrollTop={false}
        hasNew
      />,
    );

    const pathButton = screen.getByRole("button", { name: "명령 입력 열기: ~/posts" });

    expect(screen.getByRole("region", { name: "모바일 터미널 빠른 실행" })).toBeInTheDocument();
    expect(screen.getByText("~/posts")).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("[33m");
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);

    fireEvent.keyDown(pathButton, { key: " " });

    expect(onShellOpen).toHaveBeenCalled();
  });
});
