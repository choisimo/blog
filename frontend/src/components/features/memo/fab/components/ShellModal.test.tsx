import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ShellModal } from "./ShellModal";

const mockHasAuthToken = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/services/realtime/terminal", () => ({
  hasAuthToken: mockHasAuthToken,
}));

const baseProps = () => ({
  isOpen: true,
  onClose: vi.fn(),
  displayPath: "~/",
  viewportHeight: "600px",
  shellInput: "",
  setShellInput: vi.fn(),
  shellInputRef: React.createRef<HTMLInputElement>(),
  onKeyDown: vi.fn(),
  suggestions: [],
  selectedSuggestionIndex: 0,
  selectSuggestion: vi.fn(),
  shellLogs: [],
  shellOutput: null,
  consoleEndRef: React.createRef<HTMLDivElement>(),
  executeCommand: vi.fn(),
  commandHistory: [],
});

describe("ShellModal", () => {
  it("sanitizes path, suggestions, logs, and command history labels", () => {
    const props = baseProps();
    const selectSuggestion = vi.fn();
    const executeCommand = vi.fn();

    render(
      <ShellModal
        {...props}
        displayPath={"\u001b[31m~/posts\u001b[0m\u0000"}
        suggestions={["\u001b[32mhelp\u001b[0m\u0007"]}
        selectedSuggestionIndex={0}
        selectSuggestion={selectSuggestion}
        shellLogs={[
          { type: "input", text: "\u001b[33mls\u001b[0m\u0000" },
          { type: "output", text: "\u001b[34mpost.md\u001b[0m\u0000" },
        ]}
        commandHistory={["\u001b[35mfind\u001b[0m\u0000"]}
        executeCommand={executeCommand}
      />,
    );

    expect(screen.getByRole("dialog", { name: "터미널 명령 입력" })).toBeInTheDocument();
    expect(screen.getByTitle("~/posts")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "명령어 제안" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "명령어 제안 선택: help" }))
      .toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("post.md")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("\u001b");
    expect(document.body.textContent).not.toContain("[31m");
    expect(document.body.textContent).not.toContain("\u0000");

    fireEvent.click(screen.getByRole("option", { name: "명령어 제안 선택: help" }));
    fireEvent.click(screen.getByRole("button", { name: "명령 기록 실행: find" }));

    expect(selectSuggestion).toHaveBeenCalledWith("help");
    expect(executeCommand).toHaveBeenCalledWith("find");
  });

  it("exposes close, real terminal, and quick command actions", () => {
    mockHasAuthToken.mockReturnValueOnce(true);
    const onClose = vi.fn();
    const onSwitchToRealTerminal = vi.fn();
    const executeCommand = vi.fn();

    render(
      <ShellModal
        {...baseProps()}
        onClose={onClose}
        onSwitchToRealTerminal={onSwitchToRealTerminal}
        executeCommand={executeCommand}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "실제 Linux 터미널로 전환" }));
    fireEvent.click(screen.getByRole("button", { name: "빠른 명령 실행: help" }));
    fireEvent.click(screen.getByRole("button", { name: "터미널 닫기" }));

    expect(onSwitchToRealTerminal).toHaveBeenCalled();
    expect(executeCommand).toHaveBeenCalledWith("help");
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render when closed", () => {
    const { container } = render(
      <ShellModal {...baseProps()} isOpen={false} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("dialog", { name: "터미널 명령 입력" })).not.toBeInTheDocument();
  });
});
